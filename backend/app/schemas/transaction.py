from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class TransactionBase(BaseModel):
    transaction_type: str
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    account_id: int
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: datetime


class TransactionCreate(TransactionBase):
    tags: Optional[List[str]] = []
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    recurring_end_date: Optional[datetime] = None
    
    # Transfer fields
    to_account_id: Optional[int] = None
    
    # Shared budget fields
    shared_budget_id: Optional[int] = None
    distribution_method: Optional[str] = None
    distribution_data: Optional[dict] = None


class TransactionUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None
    tags: Optional[List[str]] = None


class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    amount_in_default_currency: Optional[Decimal] = None
    exchange_rate: Optional[Decimal] = None
    is_recurring: bool
    created_at: datetime
    updated_at: datetime
    tags: List[str] = []
    
    class Config:
        from_attributes = True


class TransactionFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    transaction_type: Optional[str] = None
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    currency: Optional[str] = None
    tags: Optional[List[str]] = None
    shared_budget_id: Optional[int] = None

