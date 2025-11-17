from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union
from datetime import datetime
from app.models.category import TransactionType


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Category name")
    transaction_type: TransactionType = Field(..., description="Type of transactions this category applies to")
    icon: Optional[str] = Field(None, max_length=100, description="Icon emoji or identifier")
    color: Optional[str] = Field(None, max_length=7, description="HEX color code")
    parent_id: Optional[int] = Field(None, description="Parent category ID for subcategories")
    budget_limit: Optional[float] = Field(None, description="Monthly budget limit")
    
    @field_validator('transaction_type', mode='before')
    @classmethod
    def validate_transaction_type(cls, v):
        """Convert transaction_type to lowercase enum value"""
        if isinstance(v, TransactionType):
            return v
        if isinstance(v, str):
            # Convert to lowercase and validate
            v_lower = v.lower()
            try:
                return TransactionType(v_lower)
            except ValueError:
                raise ValueError(f"Invalid transaction_type: {v}. Must be one of: income, expense, both")
        # Try to convert to string and then to enum
        try:
            return TransactionType(str(v).lower())
        except (ValueError, AttributeError):
            raise ValueError(f"Invalid transaction_type: {v}. Must be one of: income, expense, both")


class CategoryCreate(CategoryBase):
    is_favorite: Optional[bool] = Field(False, description="Add to favorite categories")
    shared_budget_id: Optional[int] = Field(None, description="Shared budget ID for shared categories")


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    transaction_type: Optional[TransactionType] = None
    icon: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=7)
    parent_id: Optional[int] = None
    is_favorite: Optional[bool] = None
    is_active: Optional[bool] = None
    budget_limit: Optional[float] = None
    
    @field_validator('transaction_type', mode='before')
    @classmethod
    def validate_transaction_type(cls, v):
        """Convert transaction_type to lowercase enum value"""
        if v is None:
            return None
        if isinstance(v, TransactionType):
            return v
        if isinstance(v, str):
            # Convert to lowercase and validate
            v_lower = v.lower()
            try:
                return TransactionType(v_lower)
            except ValueError:
                raise ValueError(f"Invalid transaction_type: {v}. Must be one of: income, expense, both")
        # Try to convert to string and then to enum
        try:
            return TransactionType(str(v).lower())
        except (ValueError, AttributeError):
            raise ValueError(f"Invalid transaction_type: {v}. Must be one of: income, expense, both")


class CategoryResponse(CategoryBase):
    id: int
    user_id: int
    shared_budget_id: Optional[int] = None
    is_system: bool
    is_active: bool
    is_favorite: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CategorySetFavorite(BaseModel):
    is_favorite: bool

