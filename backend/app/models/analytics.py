from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AnalyticsEvent(Base):
    """Модель для хранения событий аналитики"""
    __tablename__ = "analytics_events"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Идентификация пользователя
    user_id = Column(Integer, nullable=True, index=True)  # Может быть None для анонимных событий
    vk_id = Column(String(50), nullable=True, index=True)  # VK ID пользователя
    telegram_id = Column(String(50), nullable=True, index=True)  # Telegram ID пользователя
    
    # Тип события
    event_type = Column(String(50), nullable=False, index=True)  # bot_click, miniapp_open, command, action и т.д.
    event_name = Column(String(100), nullable=False, index=True)  # start, balance, expense, login и т.д.
    
    # Платформа
    platform = Column(String(20), nullable=False, index=True)  # vk_bot, vk_miniapp, telegram_bot, telegram_miniapp, web
    
    # Дополнительные данные
    event_metadata = Column(JSON, nullable=True)  # Дополнительная информация о событии
    user_agent = Column(String(500), nullable=True)  # User agent для веб-версии
    referrer = Column(String(500), nullable=True)  # Откуда пришел пользователь
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<AnalyticsEvent(id={self.id}, event_type={self.event_type}, event_name={self.event_name}, platform={self.platform})>"

