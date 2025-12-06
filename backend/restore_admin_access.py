#!/usr/bin/env python3
"""
Скрипт для быстрого восстановления доступа админов по Telegram username
Использование:
  python restore_admin_access.py przhrdsk ceo_arendix
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.core.config import settings

def restore_admin(username: str):
    """Восстановить админ доступ для пользователя по Telegram username"""
    db = SessionLocal()
    try:
        # Remove @ if present
        username = username.lstrip('@')
        
        # Find user by telegram_username
        user = db.query(User).filter(User.telegram_username == username).first()
        
        if not user:
            print(f"❌ Пользователь с Telegram username @{username} не найден в базе данных")
            print(f"   Убедитесь, что пользователь хотя бы раз входил через Telegram Mini App")
            return False
        
        if not user.telegram_id:
            print(f"❌ У пользователя @{username} нет telegram_id")
            return False
        
        old_value = user.is_admin
        user.is_admin = True
        db.commit()
        
        print(f"✅ Админ доступ восстановлен для @{username}")
        print(f"   ID пользователя: {user.id}")
        print(f"   Email: {user.email}")
        print(f"   Telegram ID: {user.telegram_id}")
        print(f"   Было: is_admin = {old_value}")
        print(f"   Стало: is_admin = {user.is_admin}")
        print(f"\n💡 Не забудьте добавить telegram_id '{user.telegram_id}' в ADMIN_TELEGRAM_IDS в Railway")
        print(f"   Это обеспечит автоматическую синхронизацию статуса админа")
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование:")
        print("  python restore_admin_access.py <username1> [username2] ...")
        print("  Пример: python restore_admin_access.py przhrdsk ceo_arendix")
        sys.exit(1)
    
    usernames = sys.argv[1:]
    print("=" * 80)
    print("Восстановление доступа админов")
    print("=" * 80)
    print(f"Пользователи для восстановления: {', '.join(usernames)}")
    print("=" * 80)
    
    success_count = 0
    for username in usernames:
        print(f"\nОбработка @{username}...")
        if restore_admin(username):
            success_count += 1
        print("-" * 80)
    
    print(f"\n{'='*80}")
    print(f"Результат: {success_count}/{len(usernames)} пользователей получили админ доступ")
    print(f"{'='*80}")
    
    if success_count > 0:
        print("\n📋 Следующие шаги:")
        print("1. Добавьте telegram_id пользователей в ADMIN_TELEGRAM_IDS в Railway")
        print("2. Перезапустите приложение (Railway сделает это автоматически)")
        print("3. Пользователи смогут войти и получить доступ к админ панели")








