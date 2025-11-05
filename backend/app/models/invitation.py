from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
import uuid
from app.core.database import Base


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class Invitation(Base):
    __tablename__ = "invitations"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Invitation details
    shared_budget_id = Column(Integer, ForeignKey("shared_budgets.id"), nullable=False)
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invited_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Set when user accepts
    
    # Invitation target (can invite by email or telegram_id)
    email = Column(String(255), nullable=True, index=True)
    telegram_id = Column(String(50), nullable=True, index=True)
    
    # Role
    role = Column(String(20), nullable=False, default="member")  # admin or member
    
    # Status
    status = Column(Enum(InvitationStatus), nullable=False, default=InvitationStatus.PENDING)
    
    # Message
    message = Column(Text, nullable=True)  # Optional message from inviter
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Optional expiration
    responded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    shared_budget = relationship("SharedBudget", foreign_keys=[shared_budget_id])
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
    invited_user = relationship("User", foreign_keys=[invited_user_id])
    
    def __repr__(self):
        return f"<Invitation(id={self.id}, token={self.token}, status={self.status})>"




