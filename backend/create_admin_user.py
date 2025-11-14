#!/usr/bin/env python3
"""
Скрипт для создания пользователя-администратора через Email
Использование:
    python create_admin_user.py
    или
    python create_admin_user.py --email admin@example.com --password admin123456
"""

import sys
import os
import argparse
from sqlalchemy.orm import Session

# Add parent directory to path to import app modules
sys.path.insert(0, '.')

# Ensure we load environment variables (Railway sets these automatically)
import os

# Print all Railway-related environment variables for debugging
print("=" * 60)
print("ENVIRONMENT CHECK")
print("=" * 60)
print(f"RAILWAY_ENVIRONMENT: {os.getenv('RAILWAY_ENVIRONMENT', 'Not set')}")
print(f"RAILWAY_PROJECT_ID: {os.getenv('RAILWAY_PROJECT_ID', 'Not set')}")
print(f"DATABASE_URL from env: {'Set' if os.getenv('DATABASE_URL') else 'NOT SET'}")
if os.getenv('DATABASE_URL'):
    db_url_env = os.getenv('DATABASE_URL')
    if '@' in db_url_env:
        # Hide password
        parts = db_url_env.split('@')
        if len(parts) == 2:
            db_url_display = parts[0].split('//')[0] + '//***:***@' + parts[1]
        else:
            db_url_display = db_url_env[:50] + '...'
    else:
        db_url_display = db_url_env
    print(f"DATABASE_URL value: {db_url_display}")
print("=" * 60)

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User

# Print database connection info for debugging
db_url_display = settings.DATABASE_URL
if len(db_url_display) > 80:
    # Hide password in PostgreSQL URLs
    if "@" in db_url_display:
        parts = db_url_display.split("@")
        if len(parts) == 2:
            db_url_display = parts[0].split("//")[0] + "//***:***@" + parts[1]
    else:
        db_url_display = db_url_display[:80] + "..."
print(f"🔍 Database URL: {db_url_display}")
print(f"🔍 Database type: {'SQLite' if 'sqlite' in settings.DATABASE_URL.lower() else 'PostgreSQL'}")
print(f"🔍 Railway environment: {os.getenv('RAILWAY_ENVIRONMENT', 'Not set')}")
print(f"🔍 Railway project: {os.getenv('RAILWAY_PROJECT_ID', 'Not set')}")


def create_admin_user(email: str = "admin@example.com", password: str = "admin123456", 
                     username: str = None, first_name: str = "Admin", 
                     last_name: str = "User"):
    """Создать пользователя-администратора"""
    # Check if database tables exist
    from sqlalchemy import inspect
    inspector = inspect(engine)
    
    if not inspector.has_table('users'):
        print("❌ Таблица 'users' не существует в базе данных!")
        print("💡 Решение: Примените миграции через Railway:")
        print("   railway run alembic upgrade head")
        return None
    
    db: Session = SessionLocal()
    
    try:
        # Проверяем, существует ли пользователь
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"⚠️  Пользователь с email {email} уже существует!")
            print(f"   ID: {existing_user.id}")
            print(f"   Username: {existing_user.username}")
            print(f"   Email: {existing_user.email}")
            print(f"   Is Active: {existing_user.is_active}")
            print(f"   Is Admin: {existing_user.is_admin}")
            
            # Обновляем статус админа, если нужно
            if not existing_user.is_admin:
                existing_user.is_admin = True
                db.commit()
                db.refresh(existing_user)
                print(f"   ✅ Статус админа обновлен!")
            else:
                print(f"   ✅ Пользователь уже является админом")
            
            return existing_user
        
        # Создаем нового пользователя-админа
        username = username or email.split("@")[0]
        hashed_password = get_password_hash(password)
        
        new_user = User(
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            hashed_password=hashed_password,
            is_active=True,
            is_verified=True,  # Админы считаются верифицированными
            is_admin=True,  # Сразу делаем админом
            default_currency="RUB",
            timezone="Europe/Moscow",
            language="ru"
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print("✅ Пользователь-администратор успешно создан!")
        print(f"\n📋 Учетные данные для входа:")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n📊 Информация о пользователе:")
        print(f"   ID: {new_user.id}")
        print(f"   Username: {new_user.username}")
        print(f"   Full Name: {new_user.first_name} {new_user.last_name}")
        print(f"   Is Active: {new_user.is_active}")
        print(f"   Is Admin: {new_user.is_admin}")
        
        return new_user
        
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка при создании пользователя: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description='Создать пользователя-администратора')
    parser.add_argument('--email', default='admin@example.com', 
                       help='Email пользователя (по умолчанию: admin@example.com)')
    parser.add_argument('--password', default='admin123456',
                       help='Пароль пользователя (по умолчанию: admin123456)')
    parser.add_argument('--username', default=None,
                       help='Username (если не указан, берется из email)')
    parser.add_argument('--first-name', default='Admin',
                       help='Имя (по умолчанию: Admin)')
    parser.add_argument('--last-name', default='User',
                       help='Фамилия (по умолчанию: User)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Создание пользователя-администратора")
    print("=" * 60)
    print()
    
    create_admin_user(
        email=args.email,
        password=args.password,
        username=args.username,
        first_name=args.first_name,
        last_name=args.last_name
    )


if __name__ == "__main__":
    main()

