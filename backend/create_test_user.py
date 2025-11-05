#!/usr/bin/env python3
"""
Скрипт для создания тестового пользователя
Использование:
    python create_test_user.py
    или
    python create_test_user.py --email test@example.com --password testpass123
"""

import sys
import argparse
from sqlalchemy.orm import Session

# Add parent directory to path to import app modules
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


def create_test_user(email: str = "test@example.com", password: str = "test123456", 
                     username: str = None, first_name: str = "Test", 
                     last_name: str = "User"):
    """Создать тестового пользователя"""
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
            return existing_user
        
        # Создаем нового пользователя
        username = username or email.split("@")[0]
        hashed_password = get_password_hash(password)
        
        new_user = User(
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            hashed_password=hashed_password,
            is_active=True,
            is_verified=False,
            default_currency="RUB",
            timezone="Europe/Moscow",
            language="ru"
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print("✅ Тестовый пользователь успешно создан!")
        print(f"\n📋 Учетные данные для входа:")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n📊 Информация о пользователе:")
        print(f"   ID: {new_user.id}")
        print(f"   Username: {new_user.username}")
        print(f"   Full Name: {new_user.first_name} {new_user.last_name}")
        print(f"   Is Active: {new_user.is_active}")
        
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
    parser = argparse.ArgumentParser(description='Создать тестового пользователя')
    parser.add_argument('--email', default='test@example.com', 
                       help='Email пользователя (по умолчанию: test@example.com)')
    parser.add_argument('--password', default='test123456',
                       help='Пароль пользователя (по умолчанию: test123456)')
    parser.add_argument('--username', default=None,
                       help='Username (если не указан, берется из email)')
    parser.add_argument('--first-name', default='Test',
                       help='Имя (по умолчанию: Test)')
    parser.add_argument('--last-name', default='User',
                       help='Фамилия (по умолчанию: User)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Создание тестового пользователя")
    print("=" * 60)
    print()
    
    create_test_user(
        email=args.email,
        password=args.password,
        username=args.username,
        first_name=args.first_name,
        last_name=args.last_name
    )


if __name__ == "__main__":
    main()




