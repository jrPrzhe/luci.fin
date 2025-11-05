from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class AccountType(str, enum.Enum):
    CASH = "cash"
    BANK_CARD = "bank_card"
    BANK_ACCOUNT = "bank_account"
    E_WALLET = "e_wallet"
    CREDIT_CARD = "credit_card"
    INVESTMENT = "investment"
    OTHER = "other"


class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Shared budget (if account belongs to shared budget)
    shared_budget_id = Column(Integer, ForeignKey("shared_budgets.id"), nullable=True, index=True)
    
    # Account details
    name = Column(String(255), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False, default=AccountType.CASH)
    currency = Column(String(3), nullable=False, default="USD")
    initial_balance = Column(Numeric(15, 2), default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)
    
    # Notes
    description = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="accounts")
    shared_budget = relationship("SharedBudget", foreign_keys=[shared_budget_id])
    transactions = relationship("Transaction", back_populates="account", primaryjoin="Account.id == Transaction.account_id")
    
    def __repr__(self):
        return f"<Account(id={self.id}, name={self.name}, type={self.account_type})>"

