"""
Скрипт для инициализации начальных данных геймификации
Запускать после применения миграций
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.gamification import DailyQuest, Achievement, QuestType, AchievementType
import json

def init_daily_quests(db):
    """Инициализировать базовые ежедневные квесты"""
    quests = [
        {
            "quest_type": QuestType.RECORD_EXPENSE,
            "title": "Запиши трату",
            "description": "Запиши любую трату сегодня",
            "xp_reward": 10,
            "conditions": None,
            "is_active": True,
        },
        {
            "quest_type": QuestType.RECORD_INCOME,
            "title": "Запиши доход",
            "description": "Запиши любой доход сегодня",
            "xp_reward": 15,
            "conditions": None,
            "is_active": True,
        },
        {
            "quest_type": QuestType.REVIEW_TRANSACTIONS,
            "title": "Проверь транзакции",
            "description": "Просмотри свои транзакции за сегодня",
            "xp_reward": 5,
            "conditions": None,
            "is_active": True,
        },
        {
            "quest_type": QuestType.CHECK_BALANCE,
            "title": "Проверь баланс",
            "description": "Посмотри баланс своих счетов",
            "xp_reward": 5,
            "conditions": None,
            "is_active": True,
        },
    ]
    
    for quest_data in quests:
        existing = db.query(DailyQuest).filter(
            DailyQuest.quest_type == quest_data["quest_type"],
            DailyQuest.title == quest_data["title"]
        ).first()
        
        if not existing:
            quest = DailyQuest(**quest_data)
            db.add(quest)
    
    db.commit()
    print("✅ Daily quests initialized")


def init_achievements(db):
    """Инициализировать базовые достижения"""
    achievements = [
        {
            "achievement_type": AchievementType.STREAK,
            "title": "Первая неделя",
            "description": "Веди учёт 7 дней подряд",
            "icon": "🔥",
            "unlock_conditions": json.dumps({"streak_days": 7}),
            "xp_reward": 50,
            "rarity": "common",
            "is_active": True,
        },
        {
            "achievement_type": AchievementType.STREAK,
            "title": "Месяц дисциплины",
            "description": "Веди учёт 30 дней подряд",
            "icon": "💪",
            "unlock_conditions": json.dumps({"streak_days": 30}),
            "xp_reward": 200,
            "rarity": "rare",
            "is_active": True,
        },
        {
            "achievement_type": AchievementType.LEVEL,
            "title": "Новичок",
            "description": "Достигни 5 уровня",
            "icon": "⭐",
            "unlock_conditions": json.dumps({"level": 5}),
            "xp_reward": 100,
            "rarity": "common",
            "is_active": True,
        },
        {
            "achievement_type": AchievementType.LEVEL,
            "title": "Опытный финансист",
            "description": "Достигни 10 уровня",
            "icon": "🌟",
            "unlock_conditions": json.dumps({"level": 10}),
            "xp_reward": 300,
            "rarity": "rare",
            "is_active": True,
        },
        {
            "achievement_type": AchievementType.HEART,
            "title": "Дружба с Люсей",
            "description": "Достигни 80 очков сердца",
            "icon": "❤️",
            "unlock_conditions": json.dumps({"heart_level": 80}),
            "xp_reward": 150,
            "rarity": "epic",
            "is_active": True,
        },
        {
            "achievement_type": AchievementType.XP,
            "title": "Первая тысяча",
            "description": "Заработай 1000 XP",
            "icon": "💎",
            "unlock_conditions": json.dumps({"total_xp": 1000}),
            "xp_reward": 200,
            "rarity": "common",
            "is_active": True,
        },
    ]
    
    for achievement_data in achievements:
        existing = db.query(Achievement).filter(
            Achievement.title == achievement_data["title"]
        ).first()
        
        if not existing:
            achievement = Achievement(**achievement_data)
            db.add(achievement)
    
    db.commit()
    print("✅ Achievements initialized")


def main():
    """Основная функция"""
    db = SessionLocal()
    try:
        print("🚀 Initializing gamification data...")
        init_daily_quests(db)
        init_achievements(db)
        print("✅ All gamification data initialized successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()









