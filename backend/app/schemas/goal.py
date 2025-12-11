from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class GoalBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=15)
    description: Optional[str] = None
    target_amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    target_date: Optional[datetime] = None
    category_id: Optional[int] = None
    
    @field_validator('name', mode='before')
    @classmethod
    def truncate_name(cls, v: Any) -> str:
        """Truncate goal name to 15 characters if it's too long"""
        if isinstance(v, str):
            return v[:15] if len(v) > 15 else v
        return str(v)[:15] if v is not None else ''


class GoalCreate(GoalBase):
    goal_type: str = "save"  # Default to save
    roadmap: Optional[str] = None  # JSON string


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=15)
    description: Optional[str] = None
    target_amount: Optional[Decimal] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    target_date: Optional[datetime] = None
    current_amount: Optional[Decimal] = None
    status: Optional[str] = None
    roadmap: Optional[str] = None
    category_id: Optional[int] = None


class GoalResponse(GoalBase):
    id: int
    user_id: int
    goal_type: str
    current_amount: Decimal
    status: str
    progress_percentage: int
    roadmap: Optional[str] = None
    start_date: datetime
    created_at: datetime
    updated_at: datetime
    
    @field_validator('status', mode='before')
    @classmethod
    def convert_status_to_string(cls, v: Any) -> str:
        """Convert status enum to string"""
        if hasattr(v, 'value'):
            return v.value
        return str(v) if v is not None else 'active'
    
    @field_validator('goal_type', mode='before')
    @classmethod
    def convert_goal_type_to_string(cls, v: Any) -> str:
        """Convert goal_type enum to string"""
        if hasattr(v, 'value'):
            return v.value
        return str(v) if v is not None else 'save'
    
    class Config:
        from_attributes = True


class GoalRoadmapRequest(BaseModel):
    goal_name: str
    target_amount: Decimal
    currency: str
    transactions: list = []  # List of transaction dicts
    balance: float = 0.0
    income_total: float = 0.0
    expense_total: float = 0.0


class GoalRoadmapResponse(BaseModel):
    roadmap: str  # JSON string with roadmap
    monthly_savings_needed: Decimal
    feasibility: str  # "feasible", "challenging", "difficult"
    recommendations: list[str] = []
    savings_by_category: Dict[str, Decimal] = {}
    estimated_months: int

















