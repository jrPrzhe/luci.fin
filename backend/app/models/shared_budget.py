from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class MemberRole(str, enum.Enum):
    ADMIN = "admin"
    MEMBER = "member"


class SharedBudget(Base):
    __tablename__ = "shared_budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Budget details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    
    # Invite code (short, easy to share)
    invite_code = Column(String(10), unique=True, index=True, nullable=False)
    
    # Settings
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    members = relationship("SharedBudgetMember", back_populates="shared_budget", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="shared_budget")
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self):
        return f"<SharedBudget(id={self.id}, name={self.name})>"


class SharedBudgetMember(Base):
    __tablename__ = "shared_budget_members"
    
    id = Column(Integer, primary_key=True, index=True)
    shared_budget_id = Column(Integer, ForeignKey("shared_budgets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Role
    role = Column(Enum(MemberRole), nullable=False, default=MemberRole.MEMBER)
    
    # Settings
    can_view_private_transactions = Column(Boolean, default=False)
    
    # Timestamps
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    shared_budget = relationship("SharedBudget", back_populates="members")
    user = relationship("User", back_populates="shared_budgets")
    
    def __repr__(self):
        return f"<SharedBudgetMember(budget_id={self.shared_budget_id}, user_id={self.user_id}, role={self.role})>"

