from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.gamification import QuestType, QuestStatus, AchievementType


class UserGamificationProfileResponse(BaseModel):
    """Ответ с профилем геймификации пользователя"""
    level: int
    xp: int
    xp_to_next_level: int
    streak_days: int
    heart_level: int
    total_xp_earned: int
    total_quests_completed: int
    last_entry_date: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class DailyQuestResponse(BaseModel):
    """Ответ с ежедневным квестом"""
    id: int
    quest_type: str
    title: str
    description: Optional[str] = None
    xp_reward: int
    status: str
    progress: int
    target_value: Optional[int] = None
    quest_date: datetime
    
    model_config = {"from_attributes": True}


class AchievementResponse(BaseModel):
    """Ответ с достижением"""
    id: int
    achievement_type: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    xp_reward: int
    rarity: str
    unlocked_at: Optional[datetime] = None
    is_unlocked: bool = False
    
    model_config = {"from_attributes": True}


class QuestCompleteRequest(BaseModel):
    """Запрос на выполнение квеста"""
    quest_id: int
    progress: Optional[int] = None  # Если указан, обновляет прогресс


class GamificationStatusResponse(BaseModel):
    """Полный статус геймификации"""
    profile: UserGamificationProfileResponse
    daily_quests: List[DailyQuestResponse]
    recent_achievements: List[AchievementResponse]
    next_level_xp: int







