from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import re


class UserBase(BaseModel):
    email: str = Field(..., description="User email address")
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    timezone: str = "UTC"
    default_currency: str = "USD"
    language: str = "en"
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format (allows .local domains for Telegram users)"""
        if not isinstance(v, str):
            raise ValueError('Email must be a string')
        
        # Basic email format validation (allows .local and other special domains)
        # Format: user@domain.tld where tld can be any string (including .local)
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+$'
        if not re.match(email_pattern, v):
            raise ValueError('Invalid email format')
        
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    timezone: Optional[str] = None
    default_currency: Optional[str] = None
    language: Optional[str] = None
    telegram_notifications_enabled: Optional[bool] = None
    vk_notifications_enabled: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    telegram_id: Optional[str] = None
    telegram_username: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool = False
    is_2fa_enabled: bool
    telegram_notifications_enabled: bool = True
    vk_notifications_enabled: bool = True
    created_at: datetime
    last_login: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format (allows .local domains)"""
        if not isinstance(v, str):
            raise ValueError('Email must be a string')
        
        # Basic email format validation (allows .local and other special domains)
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+$'
        if not re.match(email_pattern, v):
            raise ValueError('Invalid email format')
        return v


class TelegramAuth(BaseModel):
    telegram_id: str
    telegram_username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

