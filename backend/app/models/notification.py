from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class NotificationType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    ERROR = "error"


class NotificationCategory(str, enum.Enum):
    TRANSACTION = "transaction"
    BUDGET_LIMIT = "budget_limit"
    GOAL_UPDATE = "goal_update"
    SHARED_BUDGET = "shared_budget"
    AI_INSIGHT = "ai_insight"
    SYSTEM = "system"


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Notification details
    notification_type = Column(Enum(NotificationType), nullable=False)
    category = Column(Enum(NotificationCategory), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Status
    is_read = Column(Boolean, default=False)
    
    # Metadata (renamed to avoid conflict with SQLAlchemy's reserved 'metadata' attribute)
    notification_metadata = Column(Text, nullable=True)  # JSON for additional data
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<Notification(id={self.id}, title={self.title}, is_read={self.is_read})>"

