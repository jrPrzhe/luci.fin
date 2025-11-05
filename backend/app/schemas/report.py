from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class ReportCreate(BaseModel):
    report_type: str
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    filters: Optional[Dict[str, Any]] = None


class ReportResponse(BaseModel):
    id: int
    user_id: int
    report_type: str
    name: str
    description: Optional[str] = None
    data: Dict[str, Any]
    filters: Optional[Dict[str, Any]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

