from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Enum, TypeDecorator
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    BOTH = "both"


class TransactionTypeEnum(TypeDecorator):
    """Custom type decorator to ensure enum values are used instead of names"""
    impl = Enum
    cache_ok = True
    
    def __init__(self):
        # Use create_type=False since the enum type already exists in the database
        super().__init__(TransactionType, name='transactiontype', create_type=False)
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # If it's an enum, use its value (which is lowercase)
        if isinstance(value, TransactionType):
            return value.value
        # If it's a string, ensure it's lowercase
        if isinstance(value, str):
            return value.lower()
        # Fallback: convert to string and lowercase
        try:
            return str(value).lower()
        except Exception:
            return None
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Convert string value back to enum
        # Handle both uppercase (from old DB) and lowercase (from new DB) values
        if isinstance(value, str):
            value_lower = value.lower()
            # Map uppercase database values to lowercase enum values
            if value_lower == 'income':
                return TransactionType.INCOME
            elif value_lower == 'expense':
                return TransactionType.EXPENSE
            elif value_lower == 'both':
                return TransactionType.BOTH
            else:
                # Try to create enum directly (will raise ValueError if invalid)
                return TransactionType(value_lower)
        return TransactionType(value)


class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_budget_id = Column(Integer, ForeignKey("shared_budgets.id"), nullable=True)  # For shared budget categories
    
    # Category details
    name = Column(String(255), nullable=False)
    transaction_type = Column(TransactionTypeEnum(), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Customization
    icon = Column(String(100), nullable=True)
    color = Column(String(7), nullable=True)  # HEX color
    
    # Status
    is_system = Column(Boolean, default=False)  # System-defined category
    is_active = Column(Boolean, default=True)
    is_favorite = Column(Boolean, default=False)  # Top category for quick access
    
    # Settings
    budget_limit = Column(Integer, nullable=True)  # Monthly limit in default currency
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="categories")
    parent = relationship("Category", remote_side=[id], backref="subcategories")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name={self.name})>"

