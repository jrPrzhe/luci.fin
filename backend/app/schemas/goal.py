from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class GoalBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    target_date: Optional[datetime] = None
    category_id: Optional[int] = None


class GoalCreate(GoalBase):
    goal_type: str = "save"  # Default to save
    roadmap: Optional[str] = None  # JSON string


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
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





