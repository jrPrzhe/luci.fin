from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class QuestType(str, enum.Enum):
    """Тип квеста"""
    RECORD_EXPENSE = "record_expense"  # Записать трату
    RECORD_INCOME = "record_income"  # Записать доход
    REVIEW_TRANSACTIONS = "review_transactions"  # Просмотреть транзакции
    CHECK_BALANCE = "check_balance"  # Проверить баланс
    SAVE_MONEY = "save_money"  # Сэкономить определенную сумму
    CUSTOM = "custom"  # Персональный квест от ИИ


class QuestStatus(str, enum.Enum):
    """Статус квеста"""
    PENDING = "pending"  # Ожидает выполнения
    COMPLETED = "completed"  # Выполнен
    EXPIRED = "expired"  # Истек


class AchievementType(str, enum.Enum):
    """Тип достижения"""
    STREAK = "streak"  # Страйк (дни подряд)
    LEVEL = "level"  # Уровень
    TRANSACTIONS = "transactions"  # Количество транзакций
    XP = "xp"  # Накопленный XP
    HEART = "heart"  # Уровень сердца
    CUSTOM = "custom"  # Специальное достижение


class UserGamificationProfile(Base):
    """Профиль геймификации пользователя"""
    __tablename__ = "user_gamification_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    
    # Уровень и опыт
    level = Column(Integer, default=1, nullable=False)
    xp = Column(Integer, default=0, nullable=False)
    
    # Страйк (дни подряд с транзакциями)
    streak_days = Column(Integer, default=0, nullable=False)
    last_entry_date = Column(DateTime(timezone=True), nullable=True)  # Дата последней транзакции
    
    # Сердце Люси (эмоциональная связь, 0-100)
    heart_level = Column(Integer, default=50, nullable=False)  # 0-100
    
    # Дополнительная статистика
    total_xp_earned = Column(Integer, default=0, nullable=False)
    total_quests_completed = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="gamification_profile")
    daily_quests = relationship("UserDailyQuest", back_populates="profile", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="profile", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<UserGamificationProfile(user_id={self.user_id}, level={self.level}, xp={self.xp}, streak={self.streak_days})>"


class DailyQuest(Base):
    """Общие ежедневные квесты (шаблоны)"""
    __tablename__ = "daily_quests"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Описание квеста
    quest_type = Column(SQLEnum(QuestType), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Награда
    xp_reward = Column(Integer, default=10, nullable=False)
    
    # Условия выполнения (JSON)
    conditions = Column(Text, nullable=True)  # JSON с параметрами (например, {"amount": 100})
    
    # Активность
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<DailyQuest(id={self.id}, type={self.quest_type}, title={self.title})>"


class UserDailyQuest(Base):
    """Персональные ежедневные квесты пользователя"""
    __tablename__ = "user_daily_quests"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("user_gamification_profiles.id"), nullable=False, index=True)
    quest_id = Column(Integer, ForeignKey("daily_quests.id"), nullable=True)  # null для персональных квестов
    
    # Детали квеста
    quest_type = Column(SQLEnum(QuestType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Награда
    xp_reward = Column(Integer, default=10, nullable=False)
    
    # Условия выполнения (JSON)
    conditions = Column(Text, nullable=True)
    
    # Статус
    status = Column(SQLEnum(QuestStatus), default=QuestStatus.PENDING, nullable=False)
    progress = Column(Integer, default=0, nullable=False)  # Прогресс выполнения (0-100)
    target_value = Column(Integer, nullable=True)  # Целевое значение для квеста
    
    # Дата квеста (для ежедневных квестов)
    quest_date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    profile = relationship("UserGamificationProfile", back_populates="daily_quests")
    quest_template = relationship("DailyQuest")
    
    def __repr__(self):
        return f"<UserDailyQuest(id={self.id}, type={self.quest_type}, status={self.status})>"


class Achievement(Base):
    """Описание достижений"""
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Описание
    achievement_type = Column(SQLEnum(AchievementType), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)  # Эмодзи или иконка
    
    # Условия разблокировки (JSON)
    unlock_conditions = Column(Text, nullable=False)  # JSON с условиями (например, {"streak_days": 7})
    
    # Награда
    xp_reward = Column(Integer, default=50, nullable=False)
    
    # Редкость
    rarity = Column(String(20), default="common", nullable=False)  # common, rare, epic, legendary
    
    # Активность
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Achievement(id={self.id}, type={self.achievement_type}, title={self.title})>"


class UserAchievement(Base):
    """История разблокированных достижений пользователя"""
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("user_gamification_profiles.id"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False, index=True)
    
    # Дата разблокировки
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    profile = relationship("UserGamificationProfile", back_populates="achievements")
    achievement = relationship("Achievement")
    
    def __repr__(self):
        return f"<UserAchievement(id={self.id}, achievement_id={self.achievement_id}, unlocked_at={self.unlocked_at})>"


