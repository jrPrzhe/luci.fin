#!/usr/bin/env python3
"""
Скрипт для проверки подключения к базе данных PostgreSQL
Использование: python test_db_connection.py
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

# Добавляем путь к приложению
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.core.config import settings
except ImportError:
    print("❌ Ошибка: Не удалось импортировать настройки приложения")
    print("Убедитесь, что вы запускаете скрипт из директории backend/")
    sys.exit(1)


def test_connection():
    """Тестирует подключение к базе данных"""
    print("=" * 60)
    print("Проверка подключения к базе данных")
    print("=" * 60)
    print(f"Database URL: {settings.DATABASE_URL}")
    print("-" * 60)
    
    # Скрываем пароль в выводе
    db_url_display = settings.DATABASE_URL
    if "@" in db_url_display:
        parts = db_url_display.split("@")
        if ":" in parts[0]:
            user_pass = parts[0].split("://")[1] if "://" in parts[0] else parts[0]
            if ":" in user_pass:
                user, _ = user_pass.split(":", 1)
                db_url_display = db_url_display.replace(user_pass, f"{user}:***")
    
    print(f"Database URL (скрыт пароль): {db_url_display}")
    print("-" * 60)
    
    try:
        # Создаем подключение
        if settings.DATABASE_URL.startswith("sqlite"):
            engine = create_engine(
                settings.DATABASE_URL,
                connect_args={"check_same_thread": False}
            )
        else:
            engine = create_engine(
                settings.DATABASE_URL,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 10}
            )
        
        print("🔄 Попытка подключения...")
        
        # Пытаемся подключиться
        with engine.connect() as connection:
            print("✅ Подключение установлено успешно!")
            
            # Выполняем простой запрос
            print("🔄 Выполнение тестового запроса...")
            result = connection.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"✅ Версия PostgreSQL: {version.split(',')[0]}")
            
            # Проверяем текущую базу данных
            result = connection.execute(text("SELECT current_database();"))
            db_name = result.fetchone()[0]
            print(f"✅ Текущая база данных: {db_name}")
            
            # Проверяем текущего пользователя
            result = connection.execute(text("SELECT current_user;"))
            user = result.fetchone()[0]
            print(f"✅ Текущий пользователь: {user}")
            
            # Проверяем существование таблиц
            print("🔄 Проверка существования таблиц...")
            if "postgresql" in settings.DATABASE_URL.lower():
                result = connection.execute(text("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public';
                """))
                table_count = result.fetchone()[0]
                print(f"✅ Количество таблиц в схеме public: {table_count}")
            else:
                result = connection.execute(text("""
                    SELECT COUNT(*) 
                    FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%';
                """))
                table_count = result.fetchone()[0]
                print(f"✅ Количество таблиц: {table_count}")
            
            print("-" * 60)
            print("✅ Все проверки пройдены успешно!")
            print("=" * 60)
            return True
            
    except OperationalError as e:
        print("❌ Ошибка подключения к базе данных:")
        print(f"   {str(e)}")
        print("\n💡 Возможные причины:")
        print("   1. Неверный IP-адрес или порт")
        print("   2. Неверное имя пользователя или пароль")
        print("   3. База данных не существует")
        print("   4. Файрвол блокирует подключение")
        print("   5. PostgreSQL не настроен для удаленных подключений")
        print("\n📖 См. инструкции в REMOTE_DATABASE_SETUP.md")
        print("=" * 60)
        return False
        
    except SQLAlchemyError as e:
        print("❌ Ошибка SQLAlchemy:")
        print(f"   {str(e)}")
        print("=" * 60)
        return False
        
    except Exception as e:
        print("❌ Неожиданная ошибка:")
        print(f"   {type(e).__name__}: {str(e)}")
        print("=" * 60)
        return False


if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)







