#!/usr/bin/env python3
"""
Скрипт для установки премиум статуса пользователю
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User

def set_premium_by_username(telegram_username: str, is_premium: bool = True):
    """Установить премиум статус по Telegram username"""
    db = SessionLocal()
    try:
        # Убираем @ если есть
        username = telegram_username.lstrip('@')
        
        # Ищем пользователя
        user = db.query(User).filter(User.telegram_username == username).first()
        
        if not user:
            print(f"❌ Пользователь с Telegram username @{username} не найден")
            return False
        
        old_value = getattr(user, 'is_premium', False)
        
        # Проверяем, существует ли атрибут
        if not hasattr(user, 'is_premium'):
            print("❌ У модели User нет атрибута is_premium. Возможно, колонка не создана в БД.")
            print("   Запустите миграцию или скрипт check_premium_column.py")
            return False
        
        # Устанавливаем значение
        user.is_premium = is_premium
        db.commit()
        db.refresh(user)
        
        new_value = getattr(user, 'is_premium', False)
        
        print("=" * 80)
        print(f"ПРЕМИУМ СТАТУС ОБНОВЛЕН")
        print("=" * 80)
        print(f"Пользователь: @{username}")
        print(f"ID: {user.id}")
        print(f"Email: {user.email}")
        print(f"Было: is_premium = {old_value}")
        print(f"Стало: is_premium = {new_value}")
        print("=" * 80)
        
        if new_value == is_premium:
            print("✅ Премиум статус успешно обновлен!")
            return True
        else:
            print(f"❌ Ошибка: ожидалось {is_premium}, получено {new_value}")
            return False
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def set_premium_by_id(user_id: int, is_premium: bool = True):
    """Установить премиум статус по ID пользователя"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            print(f"❌ Пользователь с ID {user_id} не найден")
            return False
        
        old_value = getattr(user, 'is_premium', False)
        
        if not hasattr(user, 'is_premium'):
            print("❌ У модели User нет атрибута is_premium. Возможно, колонка не создана в БД.")
            return False
        
        user.is_premium = is_premium
        db.commit()
        db.refresh(user)
        
        new_value = getattr(user, 'is_premium', False)
        
        print("=" * 80)
        print(f"ПРЕМИУМ СТАТУС ОБНОВЛЕН")
        print("=" * 80)
        print(f"Пользователь ID: {user_id}")
        print(f"Email: {user.email}")
        if user.telegram_username:
            print(f"Telegram: @{user.telegram_username}")
        print(f"Было: is_premium = {old_value}")
        print(f"Стало: is_premium = {new_value}")
        print("=" * 80)
        
        if new_value == is_premium:
            print("✅ Премиум статус успешно обновлен!")
            return True
        else:
            print(f"❌ Ошибка: ожидалось {is_premium}, получено {new_value}")
            return False
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование:")
        print("  python set_premium_status.py @username [true|false]")
        print("  python set_premium_status.py --id USER_ID [true|false]")
        print("\nПримеры:")
        print("  python set_premium_status.py przhrdsk")
        print("  python set_premium_status.py przhrdsk true")
        print("  python set_premium_status.py przhrdsk false")
        print("  python set_premium_status.py --id 4 true")
        sys.exit(1)
    
    if sys.argv[1] == "--id":
        if len(sys.argv) < 3:
            print("❌ Укажите ID пользователя")
            sys.exit(1)
        user_id = int(sys.argv[2])
        is_premium = sys.argv[3].lower() == 'true' if len(sys.argv) > 3 else True
        set_premium_by_id(user_id, is_premium)
    else:
        username = sys.argv[1]
        is_premium = sys.argv[2].lower() == 'true' if len(sys.argv) > 2 else True
        set_premium_by_username(username, is_premium)






















