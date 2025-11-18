#!/usr/bin/env python3
"""
Скрипт для создания всех таблиц напрямую через SQLAlchemy
Используйте только для начальной настройки БД!
В production используйте миграции Alembic.
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import Base, engine
from app.models import (
    User, Account, Transaction, Category, Tag, 
    SharedBudget, SharedBudgetMember, Invitation, 
    Report, Goal, Notification
)

def create_tables():
    """Создать все таблицы в базе данных"""
    print("=" * 60)
    print("Создание таблиц в базе данных")
    print("=" * 60)
    
    try:
        # Создать все таблицы
        Base.metadata.create_all(bind=engine)
        print("✅ Все таблицы успешно созданы!")
        
        # Проверить созданные таблицы
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        print(f"\n✅ Создано таблиц: {len(tables)}")
        print("\nСписок таблиц:")
        for table in sorted(tables):
            print(f"  - {table}")
        
        print("\n" + "=" * 60)
        print("✅ Готово! Теперь можно создавать пользователей.")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Ошибка при создании таблиц: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    create_tables()











