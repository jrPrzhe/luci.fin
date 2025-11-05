from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"


class TransactionFrequency(str, enum.Enum):
    ONCE = "once"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class DistributionMethod(str, enum.Enum):
    EQUAL = "equal"  # Равномерное распределение
    PROPORTIONAL = "proportional"  # Пропорциональное распределение
    FIXED = "fixed"  # Фиксированные суммы


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    
    # Transaction details
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    
    # Conversion
    amount_in_default_currency = Column(Numeric(15, 2), nullable=True)
    exchange_rate = Column(Numeric(10, 6), nullable=True)
    
    # Categorization
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(Text, nullable=True)
    
    # Dates
    transaction_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Recurring transactions
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(Enum(TransactionFrequency), nullable=True)
    recurring_end_date = Column(DateTime(timezone=True), nullable=True)
    parent_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    
    # Transfer details
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    
    # Shared budget
    shared_budget_id = Column(Integer, ForeignKey("shared_budgets.id"), nullable=True)
    distribution_method = Column(Enum(DistributionMethod), nullable=True)
    distribution_data = Column(Text, nullable=True)  # JSON for distribution details
    
    # Goal (for savings/expenses towards a goal)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    
    # Additional metadata
    tags = relationship("Tag", secondary="transaction_tags", back_populates="transactions")
    
    # Relationships
    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions", foreign_keys=[account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])
    category = relationship("Category", backref="transactions")
    shared_budget = relationship("SharedBudget", back_populates="transactions")
    goal = relationship("Goal", backref="transactions")
    
    def __repr__(self):
        return f"<Transaction(id={self.id}, type={self.transaction_type}, amount={self.amount})>"


# Association table for transaction tags
from sqlalchemy import Table
transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", Integer, ForeignKey("transactions.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True)
)

