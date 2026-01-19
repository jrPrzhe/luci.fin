from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Numeric, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Biography(Base):
    """Модель биографии пользователя"""
    __tablename__ = "biographies"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Анкетирование данные
    monthly_income = Column(Numeric(15, 2), nullable=True)  # Зарплата/доходы
    problems = Column(Text, nullable=True)  # Проблемы пользователя (текст от ИИ)
    goal = Column(Text, nullable=True)  # Цель пользователя (текст от ИИ)
    
    # Период биографии (для хранения исторических данных)
    period_start = Column(DateTime(timezone=True), nullable=False)  # Начало периода
    period_end = Column(DateTime(timezone=True), nullable=True)  # Конец периода (если завершен)
    is_current = Column(Boolean, default=True)  # Текущая активная биография
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="biographies")
    category_limits = relationship("BiographyCategoryLimit", back_populates="biography", cascade="all, delete-orphan")
    questionnaire_response = relationship("QuestionnaireResponse", back_populates="biography", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Biography(id={self.id}, user_id={self.user_id}, is_current={self.is_current})>"


class QuestionnaireResponse(Base):
    """Ответы пользователя на анкетирование"""
    __tablename__ = "questionnaire_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    biography_id = Column(Integer, ForeignKey("biographies.id"), nullable=False, unique=True)
    
    # Ответы на слайды анкетирования
    # Слайд 1: Лимиты категорий (JSON формат)
    category_limits = Column(JSON, nullable=True)  # {"Продукты": 50000, "ЖКХ": 10000, ...}
    
    # Слайд 2: ЗП
    monthly_income = Column(Numeric(15, 2), nullable=True)
    
    # Слайд 3: Проблемы (текст пользователя + варианты если выбрал)
    problems_text = Column(Text, nullable=True)  # Свободный текст пользователя
    problems_options = Column(JSON, nullable=True)  # Выбранные варианты ["кредиты", "импульсивные покупки"]
    
    # Слайд 4: Цель (текст пользователя + варианты если выбрал)
    goal_text = Column(Text, nullable=True)  # Свободный текст пользователя
    goal_options = Column(JSON, nullable=True)  # Выбранные варианты
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    biography = relationship("Biography", back_populates="questionnaire_response")
    
    def __repr__(self):
        return f"<QuestionnaireResponse(id={self.id}, biography_id={self.biography_id})>"


class BiographyCategoryLimit(Base):
    """Лимиты категорий в биографии (фактические и плановые от ИИ)"""
    __tablename__ = "biography_category_limits"
    
    id = Column(Integer, primary_key=True, index=True)
    biography_id = Column(Integer, ForeignKey("biographies.id"), nullable=False)
    
    # Название категории (может быть как системной, так и пользовательской)
    category_name = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Связь с категорией если существует
    
    # Лимиты
    user_limit = Column(Numeric(15, 2), nullable=False)  # Фактический лимит от пользователя
    ai_recommended_limit = Column(Numeric(15, 2), nullable=True)  # Плановый лимит от ИИ
    actual_spent = Column(Numeric(15, 2), default=0)  # Фактически потрачено (обновляется по тратам)
    
    # Валюта
    currency = Column(String(3), nullable=False, default="USD")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    biography = relationship("Biography", back_populates="category_limits")
    category = relationship("Category")
    
    def __repr__(self):
        return f"<BiographyCategoryLimit(id={self.id}, category_name={self.category_name}, user_limit={self.user_limit}, ai_limit={self.ai_recommended_limit})>"
