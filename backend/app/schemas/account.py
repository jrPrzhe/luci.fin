from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal, InvalidOperation


class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60, description="Account name")
    account_type: str
    currency: str = Field(..., min_length=3, max_length=3)
    initial_balance: Decimal = Decimal("0")
    description: Optional[str] = Field(None, max_length=500, description="Account description")
    
    @field_validator('initial_balance')
    @classmethod
    def validate_initial_balance(cls, v):
        """Validate initial_balance is within acceptable range"""
        if not isinstance(v, Decimal):
            try:
                v = Decimal(str(v))
            except (ValueError, InvalidOperation, TypeError):
                raise ValueError("Неверное значение начального баланса")
        
        # Prevent negative numbers
        if v < 0:
            raise ValueError("Начальный баланс не может быть отрицательным")
        
        # Maximum value for Numeric(15, 2): 999,999,999,999,999.99
        MAX_BALANCE = Decimal('999999999999999.99')
        if abs(v) > MAX_BALANCE:
            raise ValueError("Сумма слишком большая. Максимальная сумма: 999 999 999 999 999.99")
        
        return v


class AccountCreate(AccountBase):
    shared_budget_id: Optional[int] = None  # If provided, account belongs to shared budget


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=60, description="Account name")
    account_type: Optional[str] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    description: Optional[str] = Field(None, max_length=500, description="Account description")
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None


class AccountResponse(AccountBase):
    id: int
    user_id: int
    is_active: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    balance: Optional[Decimal] = None  # Calculated balance
    
    class Config:
        from_attributes = True

