from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True)
    
    # Authentication
    hashed_password = Column(String(255))
    telegram_id = Column(String(50), index=True, nullable=True)  # Removed unique to allow account linking
    telegram_username = Column(String(100), nullable=True)
    vk_id = Column(String(50), index=True, nullable=True)  # Removed unique to allow account linking
    
    # Profile
    first_name = Column(String(100))
    last_name = Column(String(100))
    timezone = Column(String(50), default="UTC")
    default_currency = Column(String(3), default="USD")
    language = Column(String(5), default="en")
    theme = Column(String(10), default="dark")  # "light" or "dark"
    valentine_theme = Column(Boolean, default=True)  # Режим Дня святого Валентина
    stranger_things_theme = Column(Boolean, default=False)  # Тема Stranger Things (ОСД)
    
    # 2FA
    is_2fa_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(32), nullable=True)
    backup_codes = Column(Text, nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)  # Premium subscription status
    verification_token = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    accounts = relationship("Account", back_populates="owner", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    shared_budgets = relationship("SharedBudgetMember", back_populates="user")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    gamification_profile = relationship("UserGamificationProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"

