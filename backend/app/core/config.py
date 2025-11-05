from pydantic_settings import BaseSettings
from typing import List
import os


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
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://localhost:5173",
        # ngrok domains (will be added dynamically if needed)
    ]
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        
        @classmethod
        def parse_env_var(cls, field_name: str, raw_val: str) -> any:
            if field_name == 'CORS_ORIGINS':
                if raw_val:
                    origins = [origin.strip() for origin in raw_val.split(',') if origin.strip()]
                else:
                    origins = []
                return origins
            return cls.json_loads(raw_val)


settings = Settings()

