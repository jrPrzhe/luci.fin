from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime, Enum, Text, TypeDecorator, event
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"


class TransactionTypeEnum(TypeDecorator):
    """Custom type decorator to ensure enum values are used instead of names"""
    impl = Enum
    cache_ok = True
    
    def __init__(self):
        super().__init__(TransactionType, name='transactiontype', create_type=False)
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # If it's an enum, use its value; if it's a string, ensure it's lowercase
        if isinstance(value, TransactionType):
            return value.value
        # If it's a string, ensure it's lowercase and return as-is
        if isinstance(value, str):
            return value.lower()
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Convert string value back to enum
        return TransactionType(value)


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
    # Use custom TypeDecorator to ensure enum values ("income") are used instead of names ("INCOME")
    transaction_type = Column(TransactionTypeEnum(), nullable=False)
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


# Event listener to ensure transaction_type is always lowercase string
@event.listens_for(Transaction, 'before_insert', propagate=True)
@event.listens_for(Transaction, 'before_update', propagate=True)
def receive_before_insert(mapper, connection, target):
    """Ensure transaction_type is always lowercase string before insert/update"""
    if hasattr(target, 'transaction_type') and target.transaction_type is not None:
        current_value = target.transaction_type
        # Convert to lowercase string if needed
        if isinstance(current_value, TransactionType):
            # Use enum value (lowercase string)
            object.__setattr__(target, 'transaction_type', current_value.value)
        elif isinstance(current_value, str):
            # Ensure lowercase
            if current_value != current_value.lower():
                object.__setattr__(target, 'transaction_type', current_value.lower())


# Association table for transaction tags
from sqlalchemy import Table
transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", Integer, ForeignKey("transactions.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True)
)

