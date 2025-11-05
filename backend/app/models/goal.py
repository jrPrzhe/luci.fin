from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Boolean, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class GoalType(str, enum.Enum):
    SAVE = "save"
    SPEND_LESS = "spend_less"
    INVEST = "invest"


class GoalStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Goal details
    goal_type = Column(Enum(GoalType), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Targets
    target_amount = Column(Numeric(15, 2), nullable=False)
    current_amount = Column(Numeric(15, 2), default=0)
    currency = Column(String(3), nullable=False, default="USD")
    
    # Dates
    start_date = Column(DateTime(timezone=True), nullable=False)
    target_date = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(Enum(GoalStatus), nullable=False, default=GoalStatus.ACTIVE)
    progress_percentage = Column(Integer, default=0)
    
    # Category (optional)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Account for goal (automatically created when goal is created)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    
    # Roadmap/Plan (JSON stored as text)
    roadmap = Column(Text, nullable=True)  # JSON string with step-by-step plan
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="goals")
    category = relationship("Category")
    account = relationship("Account", foreign_keys=[account_id])
    
    def __repr__(self):
        return f"<Goal(id={self.id}, name={self.name}, type={self.goal_type})>"

