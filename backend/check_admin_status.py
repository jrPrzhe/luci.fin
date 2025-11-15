#!/usr/bin/env python3
"""
Скрипт для проверки статуса администратора пользователя
Использование: python check_admin_status.py <telegram_id>
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User

def check_admin_status(telegram_id: str):
    """Проверить статус администратора для указанного Telegram ID"""
    
    print(f"\n{'='*60}")
    print(f"Проверка статуса администратора")
    print(f"{'='*60}\n")
    
    # Проверка конфигурации
    print(f"📋 Конфигурация:")
    print(f"   ADMIN_TELEGRAM_IDS = {settings.ADMIN_TELEGRAM_IDS}")
    print(f"   Тип: {type(settings.ADMIN_TELEGRAM_IDS)}")
    print(f"   Длина: {len(settings.ADMIN_TELEGRAM_IDS) if isinstance(settings.ADMIN_TELEGRAM_IDS, list) else 'N/A'}\n")
    
    # Проверка в списке админов
    telegram_id_str = str(telegram_id)
    is_in_admin_list = telegram_id_str in settings.ADMIN_TELEGRAM_IDS
    
    print(f"🔍 Проверка Telegram ID: {telegram_id_str}")
    print(f"   В списке ADMIN_TELEGRAM_IDS: {is_in_admin_list}")
    if is_in_admin_list:
        print(f"   ✅ Telegram ID найден в списке администраторов")
    else:
        print(f"   ❌ Telegram ID НЕ найден в списке администраторов")
        print(f"   Проверьте, что значение в ADMIN_TELEGRAM_IDS совпадает точно")
    
    # Проверка в базе данных
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == telegram_id_str).first()
        
        if user:
            print(f"\n👤 Пользователь в базе данных:")
            print(f"   ID: {user.id}")
            print(f"   Email: {user.email}")
            print(f"   Telegram ID: {user.telegram_id}")
            print(f"   Telegram Username: {user.telegram_username}")
            print(f"   Имя: {user.first_name} {user.last_name}")
            print(f"   is_admin: {user.is_admin}")
            
            if user.is_admin:
                print(f"   ✅ Пользователь имеет права администратора в БД")
            else:
                print(f"   ❌ Пользователь НЕ имеет прав администратора в БД")
                if is_in_admin_list:
                    print(f"   ⚠️  Telegram ID в списке админов, но is_admin=False в БД")
                    print(f"   💡 Решение: Войдите через Telegram Mini App - статус обновится автоматически")
        else:
            print(f"\n❌ Пользователь с Telegram ID '{telegram_id_str}' не найден в базе данных")
            print(f"   Создайте пользователя, войдя через Telegram Mini App")
    finally:
        db.close()
    
    print(f"\n{'='*60}\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python check_admin_status.py <telegram_id>")
        print("Пример: python check_admin_status.py 7295487724")
        sys.exit(1)
    
    telegram_id = sys.argv[1]
    check_admin_status(telegram_id)





