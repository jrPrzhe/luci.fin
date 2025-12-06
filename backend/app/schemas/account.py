from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Account name")
    account_type: str
    currency: str = Field(..., min_length=3, max_length=3)
    initial_balance: Decimal = Decimal("0")
    description: Optional[str] = Field(None, max_length=500, description="Account description")


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Account name")
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

