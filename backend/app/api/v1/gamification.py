from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import logging

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.gamification import (
    UserGamificationProfile,
    DailyQuest,
    UserDailyQuest,
    Achievement,
    UserAchievement,
    QuestType,
    QuestStatus,
    AchievementType,
)
from app.schemas.gamification import (
    UserGamificationProfileResponse,
    DailyQuestResponse,
    AchievementResponse,
    QuestCompleteRequest,
    GamificationStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Константы для геймификации
XP_PER_LEVEL = 100  # XP необходимое для каждого уровня (линейная прогрессия)
XP_FOR_TRANSACTION = 5  # XP за транзакцию
XP_FOR_STREAK = 2  # Дополнительный XP за страйк
HEART_DECAY_PER_DAY = 5  # Уменьшение сердца за пропущенный день
HEART_INCREASE_PER_ACTION = 1  # Увеличение сердца за действие


def get_or_create_profile(user_id: int, db: Session) -> UserGamificationProfile:
    """Получить или создать профиль геймификации"""
    profile = db.query(UserGamificationProfile).filter(
        UserGamificationProfile.user_id == user_id
    ).first()
    
    if not profile:
        profile = UserGamificationProfile(
            user_id=user_id,
            level=1,
            xp=0,
            streak_days=0,
            heart_level=50,
            total_xp_earned=0,
            total_quests_completed=0,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    return profile


def calculate_xp_for_level(level: int) -> int:
    """Вычислить необходимый XP для уровня"""
    return level * XP_PER_LEVEL


def check_level_up(profile: UserGamificationProfile, db: Session) -> bool:
    """Проверить и обновить уровень, если нужно. Возвращает True, если был уровень ап."""
    xp_needed = calculate_xp_for_level(profile.level)
    
    if profile.xp >= xp_needed:
        profile.level += 1
        profile.xp -= xp_needed
        db.commit()
        return True
    return False


def update_streak(profile: UserGamificationProfile, transaction_date: datetime, db: Session) -> bool:
    """Обновить страйк. Возвращает True, если страйк был сброшен."""
    if not profile.last_entry_date:
        # Первая транзакция
        profile.streak_days = 1
        profile.last_entry_date = transaction_date.date()
        db.commit()
        return False
    
    last_date = profile.last_entry_date
    if isinstance(last_date, datetime):
        last_date = last_date.date()
    
    current_date = transaction_date.date() if isinstance(transaction_date, datetime) else transaction_date
    
    # Проверяем, был ли пропущен день
    if current_date == last_date:
        # Транзакция в тот же день - не обновляем страйк
        return False
    elif current_date == last_date + timedelta(days=1):
        # Следующий день - увеличиваем страйк
        profile.streak_days += 1
        profile.last_entry_date = current_date
        db.commit()
        return False
    else:
        # Пропущен день - сбрасываем страйк
        was_broken = profile.streak_days > 0
        profile.streak_days = 1
        profile.last_entry_date = current_date
        # Уменьшаем сердце за пропуск
        profile.heart_level = max(0, profile.heart_level - HEART_DECAY_PER_DAY)
        db.commit()
        return was_broken


def add_xp(profile: UserGamificationProfile, amount: int, db: Session) -> dict:
    """Добавить XP и проверить уровень ап. Возвращает информацию о результате."""
    profile.xp += amount
    profile.total_xp_earned += amount
    
    level_up = check_level_up(profile, db)
    
    # Увеличиваем сердце за активность
    profile.heart_level = min(100, profile.heart_level + HEART_INCREASE_PER_ACTION)
    db.commit()
    
    return {
        "level_up": level_up,
        "new_level": profile.level,
        "new_xp": profile.xp,
    }


def check_achievements(profile: UserGamificationProfile, db: Session) -> List[Achievement]:
    """Проверить и разблокировать достижения. Возвращает список новых достижений."""
    new_achievements = []
    
    # Получаем все активные достижения
    achievements = db.query(Achievement).filter(Achievement.is_active == True).all()
    
    for achievement in achievements:
        # Проверяем, не разблокировано ли уже
        existing = db.query(UserAchievement).filter(
            UserAchievement.profile_id == profile.id,
            UserAchievement.achievement_id == achievement.id
        ).first()
        
        if existing:
            continue
        
        # Парсим условия
        try:
            conditions = json.loads(achievement.unlock_conditions) if achievement.unlock_conditions else {}
        except:
            continue
        
        # Проверяем условия
        unlocked = False
        
        if achievement.achievement_type == AchievementType.STREAK:
            required_streak = conditions.get("streak_days", 0)
            if profile.streak_days >= required_streak:
                unlocked = True
        
        elif achievement.achievement_type == AchievementType.LEVEL:
            required_level = conditions.get("level", 0)
            if profile.level >= required_level:
                unlocked = True
        
        elif achievement.achievement_type == AchievementType.XP:
            required_xp = conditions.get("total_xp", 0)
            if profile.total_xp_earned >= required_xp:
                unlocked = True
        
        elif achievement.achievement_type == AchievementType.HEART:
            required_heart = conditions.get("heart_level", 0)
            if profile.heart_level >= required_heart:
                unlocked = True
        
        if unlocked:
            # Разблокируем достижение
            user_achievement = UserAchievement(
                profile_id=profile.id,
                achievement_id=achievement.id
            )
            db.add(user_achievement)
            
            # Начисляем награду
            if achievement.xp_reward > 0:
                add_xp(profile, achievement.xp_reward, db)
            
            new_achievements.append(achievement)
    
    if new_achievements:
        db.commit()
    
    return new_achievements


def generate_daily_quests(profile: UserGamificationProfile, db: Session, user: User):
    """Генерировать ежедневные квесты для пользователя"""
    today = datetime.now(timezone.utc).date()
    
    # Проверяем, есть ли уже квесты на сегодня
    existing_quests = db.query(UserDailyQuest).filter(
        UserDailyQuest.profile_id == profile.id,
        UserDailyQuest.quest_date == today,
        UserDailyQuest.status != QuestStatus.EXPIRED
    ).all()
    
    if existing_quests:
        return existing_quests
    
    # Получаем активные шаблоны квестов
    quest_templates = db.query(DailyQuest).filter(DailyQuest.is_active == True).all()
    
    # Создаем квесты из шаблонов
    for template in quest_templates[:2]:  # Максимум 2 общих квеста
        user_quest = UserDailyQuest(
            profile_id=profile.id,
            quest_id=template.id,
            quest_type=template.quest_type,
            title=template.title,
            description=template.description,
            xp_reward=template.xp_reward,
            conditions=template.conditions,
            quest_date=today,
            status=QuestStatus.PENDING,
            progress=0,
        )
        db.add(user_quest)
    
    # TODO: Генерировать персональный квест через ИИ (можно добавить позже)
    
    db.commit()
    
    # Получаем созданные квесты
    return db.query(UserDailyQuest).filter(
        UserDailyQuest.profile_id == profile.id,
        UserDailyQuest.quest_date == today
    ).all()


@router.get("/status", response_model=GamificationStatusResponse)
async def get_gamification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить полный статус геймификации"""
    profile = get_or_create_profile(current_user.id, db)
    
    # Генерируем ежедневные квесты, если их нет
    generate_daily_quests(profile, db, current_user)
    
    # Получаем квесты на сегодня
    today = datetime.now(timezone.utc).date()
    daily_quests = db.query(UserDailyQuest).filter(
        UserDailyQuest.profile_id == profile.id,
        UserDailyQuest.quest_date == today
    ).all()
    
    # Получаем последние достижения
    recent_achievements = db.query(UserAchievement).filter(
        UserAchievement.profile_id == profile.id
    ).order_by(UserAchievement.unlocked_at.desc()).limit(5).all()
    
    # Вычисляем XP до следующего уровня
    xp_needed = calculate_xp_for_level(profile.level)
    xp_to_next_level = xp_needed - profile.xp
    
    return GamificationStatusResponse(
        profile=UserGamificationProfileResponse(
            level=profile.level,
            xp=profile.xp,
            xp_to_next_level=xp_to_next_level,
            streak_days=profile.streak_days,
            heart_level=profile.heart_level,
            total_xp_earned=profile.total_xp_earned,
            total_quests_completed=profile.total_quests_completed,
            last_entry_date=profile.last_entry_date,
        ),
        daily_quests=[DailyQuestResponse.model_validate(q) for q in daily_quests],
        recent_achievements=[
            AchievementResponse(
                id=ua.achievement.id,
                achievement_type=ua.achievement.achievement_type.value,
                title=ua.achievement.title,
                description=ua.achievement.description,
                icon=ua.achievement.icon,
                xp_reward=ua.achievement.xp_reward,
                rarity=ua.achievement.rarity,
                unlocked_at=ua.unlocked_at,
                is_unlocked=True,
            ) for ua in recent_achievements
        ],
        next_level_xp=xp_needed,
    )


@router.get("/quests", response_model=List[DailyQuestResponse])
async def get_daily_quests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить ежедневные квесты"""
    profile = get_or_create_profile(current_user.id, db)
    generate_daily_quests(profile, db, current_user)
    
    today = datetime.now(timezone.utc).date()
    quests = db.query(UserDailyQuest).filter(
        UserDailyQuest.profile_id == profile.id,
        UserDailyQuest.quest_date == today
    ).all()
    
    return [DailyQuestResponse.model_validate(q) for q in quests]


@router.post("/quests/{quest_id}/complete", response_model=DailyQuestResponse)
async def complete_quest(
    quest_id: int,
    request: Optional[QuestCompleteRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Выполнить квест"""
    profile = get_or_create_profile(current_user.id, db)
    
    quest = db.query(UserDailyQuest).filter(
        UserDailyQuest.id == quest_id,
        UserDailyQuest.profile_id == profile.id
    ).first()
    
    if not quest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quest not found"
        )
    
    if quest.status == QuestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quest already completed"
        )
    
    # Обновляем прогресс, если указан
    if request and request.progress is not None:
        quest.progress = min(100, max(0, request.progress))
    
    # Помечаем как выполненный
    quest.status = QuestStatus.COMPLETED
    quest.completed_at = datetime.now(timezone.utc)
    quest.progress = 100
    
    # Начисляем XP
    result = add_xp(profile, quest.xp_reward, db)
    profile.total_quests_completed += 1
    
    # Проверяем достижения
    new_achievements = check_achievements(profile, db)
    
    db.commit()
    
    return DailyQuestResponse.model_validate(quest)


@router.get("/achievements", response_model=List[AchievementResponse])
async def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все достижения (с информацией о разблокировке)"""
    profile = get_or_create_profile(current_user.id, db)
    
    # Получаем все достижения
    all_achievements = db.query(Achievement).filter(Achievement.is_active == True).all()
    
    # Получаем разблокированные
    unlocked_ids = {
        ua.achievement_id for ua in db.query(UserAchievement).filter(
            UserAchievement.profile_id == profile.id
        ).all()
    }
    
    result = []
    for achievement in all_achievements:
        user_achievement = db.query(UserAchievement).filter(
            UserAchievement.profile_id == profile.id,
            UserAchievement.achievement_id == achievement.id
        ).first()
        
        result.append(AchievementResponse(
            id=achievement.id,
            achievement_type=achievement.achievement_type.value,
            title=achievement.title,
            description=achievement.description,
            icon=achievement.icon,
            xp_reward=achievement.xp_reward,
            rarity=achievement.rarity,
            unlocked_at=user_achievement.unlocked_at if user_achievement else None,
            is_unlocked=user_achievement is not None,
        ))
    
    return result

