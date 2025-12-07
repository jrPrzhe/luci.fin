from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class SharedBudgetBase(BaseModel):
    name: str = Field(..., max_length=100, description="Budget name")
    description: Optional[str] = None
    currency: str = Field(..., min_length=3, max_length=3)
    
    @field_validator('name')
    @classmethod
    def validate_name_length(cls, v: str) -> str:
        """Validate budget name length"""
        if len(v) > 100:
            raise ValueError('Название бюджета не должно превышать 100 символов')
        return v


class SharedBudgetCreate(SharedBudgetBase):
    pass


class SharedBudgetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SharedBudgetResponse(SharedBudgetBase):
    id: int
    created_by: int
    invite_code: Optional[str] = None  # Can be None for old records
    is_active: bool
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    
    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    email: Optional[str] = None
    telegram_id: Optional[str] = None
    role: str = "member"


class MemberResponse(BaseModel):
    id: int
    shared_budget_id: int
    user_id: int
    role: str
    joined_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True

