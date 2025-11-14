#!/usr/bin/env python3
"""
Скрипт для проверки доступа админа и установки статуса
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.core.config import settings


def check_admin_status(user_id: int = None, email: str = None, telegram_id: str = None):
    """Проверить статус админа пользователя"""
    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif email:
            user = db.query(User).filter(User.email == email).first()
        elif telegram_id:
            user = db.query(User).filter(User.telegram_id == telegram_id).first()
        else:
            print("❌ Укажите user_id, email или telegram_id")
            return
        
        if not user:
            print(f"❌ Пользователь не найден")
            return
        
        print("=" * 80)
        print("Информация о пользователе")
        print("=" * 80)
        print(f"ID: {user.id}")
        print(f"Email: {user.email}")
        print(f"Username: {user.username}")
        print(f"Telegram ID: {user.telegram_id}")
        print(f"Telegram Username: {user.telegram_username}")
        print(f"Is Admin: {user.is_admin}")
        print(f"Is Active: {user.is_active}")
        print(f"Is Verified: {user.is_verified}")
        print("-" * 80)
        
        # Проверка ADMIN_TELEGRAM_IDS
        if user.telegram_id:
            should_be_admin = str(user.telegram_id) in settings.ADMIN_TELEGRAM_IDS
            print(f"ADMIN_TELEGRAM_IDS: {settings.ADMIN_TELEGRAM_IDS}")
            print(f"Telegram ID в списке админов: {should_be_admin}")
            
            if should_be_admin and not user.is_admin:
                print("\n[WARNING] Пользователь должен быть админом, но is_admin = False")
                print("   Выполните: python check_admin_access.py --set-admin {user.id}")
        else:
            print("[WARNING] У пользователя нет Telegram ID")
            print("   Для email пользователей админ устанавливается вручную")
        
        print("=" * 80)
        
    finally:
        db.close()


def set_admin(user_id: int = None, email: str = None, telegram_id: str = None, value: bool = True):
    """Установить статус админа"""
    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif email:
            user = db.query(User).filter(User.email == email).first()
        elif telegram_id:
            user = db.query(User).filter(User.telegram_id == telegram_id).first()
        else:
            print("❌ Укажите user_id, email или telegram_id")
            return
        
        if not user:
            print(f"❌ Пользователь не найден")
            return
        
        old_value = user.is_admin
        user.is_admin = value
        db.commit()
        
        print(f"[OK] Статус админа обновлен для пользователя {user.id} ({user.email})")
        print(f"   Было: is_admin = {old_value}")
        print(f"   Стало: is_admin = {value}")
        
    finally:
        db.close()


def list_all_users():
    """Список всех пользователей"""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        
        print("=" * 80)
        print(f"Всего пользователей: {len(users)}")
        print("=" * 80)
        
        for user in users:
            admin_status = "[ADMIN]" if user.is_admin else "[USER]"
            print(f"{admin_status} ID: {user.id:3d} | Email: {user.email:30s} | Telegram: {user.telegram_id or 'N/A':15s} | Admin: {user.is_admin}")
        
        print("=" * 80)
        
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование:")
        print("  python check_admin_access.py --list                    # Список всех пользователей")
        print("  python check_admin_access.py --check --user-id 1       # Проверить по ID")
        print("  python check_admin_access.py --check --email user@example.com  # Проверить по email")
        print("  python check_admin_access.py --check --telegram-id 123456789    # Проверить по Telegram ID")
        print("  python check_admin_access.py --set-admin --user-id 1  # Установить админом")
        print("  python check_admin_access.py --set-admin --email user@example.com  # Установить админом")
        sys.exit(1)
    
    if "--list" in sys.argv:
        list_all_users()
    elif "--check" in sys.argv:
        if "--user-id" in sys.argv:
            idx = sys.argv.index("--user-id")
            user_id = int(sys.argv[idx + 1])
            check_admin_status(user_id=user_id)
        elif "--email" in sys.argv:
            idx = sys.argv.index("--email")
            email = sys.argv[idx + 1]
            check_admin_status(email=email)
        elif "--telegram-id" in sys.argv:
            idx = sys.argv.index("--telegram-id")
            telegram_id = sys.argv[idx + 1]
            check_admin_status(telegram_id=telegram_id)
        else:
            print("❌ Укажите --user-id, --email или --telegram-id")
    elif "--set-admin" in sys.argv:
        if "--user-id" in sys.argv:
            idx = sys.argv.index("--user-id")
            user_id = int(sys.argv[idx + 1])
            set_admin(user_id=user_id)
        elif "--email" in sys.argv:
            idx = sys.argv.index("--email")
            email = sys.argv[idx + 1]
            set_admin(email=email)
        else:
            print("❌ Укажите --user-id или --email")
    else:
        print("❌ Неизвестная команда")

