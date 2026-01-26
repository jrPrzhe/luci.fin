from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, Field
from typing import List, Union
import os
import json


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Finance Manager"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Security (defaults to a dev key if not provided - CHANGE IN PRODUCTION!)
    SECRET_KEY: str = "dev-secret-key-change-in-production-please-use-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database (defaults to SQLite if not provided)
    DATABASE_URL: str = "sqlite:///./finance.db"
    
    # Redis (optional, not required for basic functionality)
    REDIS_URL: str = ""
    
    # CORS (includes ngrok domains for Mini App)
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=[
            "http://localhost:3000", 
            "http://localhost:5173",
        ],
        description="CORS allowed origins"
    )
    
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    
    # Google AI Studio (Gemini)
    GOOGLE_AI_API_KEY: str = ""
    
    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_URL: str = ""
    ADMIN_TELEGRAM_USERNAMES: Union[List[str], str] = Field(
        default=[],
        description="List of Telegram usernames (without @) that should have admin access"
    )
    ADMIN_TELEGRAM_IDS: Union[List[str], str] = Field(
        default=[],
        description="List of Telegram user IDs (as strings) that should have admin access"
    )
    
    # VK
    VK_BOT_TOKEN: str = ""
    VK_GROUP_ID: str = ""
    VK_APP_SECRET: str = ""  # Secret Key for VK Mini App signature verification
    # Public link to VK Mini App (used in VK-bot and reminders)
    # Example: https://vk.com/app54321962_144352158
    VK_MINIAPP_URL: str = "https://vk.com/app54321962_144352158"
    
    # External APIs
    EXCHANGE_RATE_API_KEY: str = ""
    
    # Security
    ENABLE_2FA: bool = True
    SESSION_TIMEOUT_MINUTES: int = 60
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Celery
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            # Try to parse as JSON first
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
            
            # If not JSON, parse as comma-separated string
            if v.strip():
                origins = [origin.strip() for origin in v.split(',') if origin.strip()]
                return origins
            return []
        elif isinstance(v, list):
            return v
        return []
    
    @field_validator('ADMIN_TELEGRAM_USERNAMES', mode='before')
    @classmethod
    def parse_admin_usernames(cls, v):
        result = []
        if isinstance(v, str):
            # Try to parse as JSON first
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    result = parsed
                else:
                    return []
            except (json.JSONDecodeError, ValueError):
                # If not JSON, parse as comma-separated string
                if v.strip():
                    result = [username.strip() for username in v.split(',') if username.strip()]
                else:
                    return []
        elif isinstance(v, list):
            result = v
        else:
            return []
        
        # Normalize all usernames: remove @ if present and convert to lowercase
        normalized = []
        for username in result:
            if username is not None:
                # Remove @ if present
                username = str(username).strip().lstrip('@')
                # Convert to lowercase for case-insensitive comparison
                if username:
                    normalized.append(username.lower())
        return normalized
    
    @field_validator('ADMIN_TELEGRAM_IDS', mode='before')
    @classmethod
    def parse_admin_telegram_ids(cls, v):
        result = []
        if isinstance(v, str):
            # Try to parse as JSON first
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    result = parsed
                else:
                    return []
            except (json.JSONDecodeError, ValueError):
                # If not JSON, parse as comma-separated string
                if v.strip():
                    result = [telegram_id.strip() for telegram_id in v.split(',') if telegram_id.strip()]
                else:
                    return []
        elif isinstance(v, list):
            result = v
        else:
            return []
        
        # Normalize all IDs: convert to string
        normalized = []
        for telegram_id in result:
            if telegram_id is not None:
                telegram_id = str(telegram_id).strip()
                if telegram_id:
                    normalized.append(telegram_id)
        return normalized
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

