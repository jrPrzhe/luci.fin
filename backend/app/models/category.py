from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    BOTH = "both"


class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_budget_id = Column(Integer, ForeignKey("shared_budgets.id"), nullable=True)  # For shared budget categories
    
    # Category details
    name = Column(String(255), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
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

