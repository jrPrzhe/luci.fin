#!/usr/bin/env python3
"""
Скрипт для проверки схемы базы данных
Проверяет наличие всех необходимых таблиц и их структуру
"""
import sys
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

# Добавляем путь к приложению
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.core.config import settings
except ImportError:
    print("❌ Ошибка: Не удалось импортировать настройки приложения")
    print("Убедитесь, что вы запускаете скрипт из директории backend/")
    sys.exit(1)

# Ожидаемые таблицы
EXPECTED_TABLES = [
    "users",
    "accounts",
    "transactions",
    "categories",
    "tags",
    "transaction_tags",
    "goals",
    "shared_budgets",
    "shared_budget_members",
    "invitations",
    "reports",
    "notifications",
    "alembic_version"
]

# Ожидаемые колонки для основных таблиц
EXPECTED_COLUMNS = {
    "users": ["id", "email", "username", "hashed_password", "is_active", "created_at"],
    "accounts": ["id", "user_id", "name", "account_type", "currency", "is_active"],
    "transactions": ["id", "user_id", "account_id", "transaction_type", "amount", "currency", "transaction_date"],
    "categories": ["id", "user_id", "name", "transaction_type", "is_active"],
    "tags": ["id", "user_id", "name"],
    "goals": ["id", "user_id", "name", "target_amount", "currency", "status"],
    "shared_budgets": ["id", "created_by", "name", "currency", "invite_code"],
    "shared_budget_members": ["id", "shared_budget_id", "user_id", "role"],
    "invitations": ["id", "shared_budget_id", "invited_by_user_id", "status"],
    "reports": ["id", "user_id", "name", "report_type", "data"],
    "notifications": ["id", "user_id", "title", "message", "is_read"],
    "transaction_tags": ["transaction_id", "tag_id"],
    "alembic_version": ["version_num"]
}


def check_database_schema():
    """Проверка схемы базы данных"""
    print("=" * 80)
    print("Проверка схемы базы данных")
    print("=" * 80)
    print(f"Database URL: {settings.DATABASE_URL[:50]}...")
    print("-" * 80)
    
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
                connect_args={
                    "connect_timeout": 10,
                    "client_encoding": "utf8"
                }
            )
        
        inspector = inspect(engine)
        
        # Получаем список таблиц
        existing_tables = inspector.get_table_names()
        
        print(f"\n📊 Найдено таблиц: {len(existing_tables)}")
        print(f"📋 Ожидается таблиц: {len(EXPECTED_TABLES)}")
        print("-" * 80)
        
        # Проверка наличия таблиц
        print("\n✅ Проверка наличия таблиц:")
        missing_tables = []
        extra_tables = []
        
        for table in EXPECTED_TABLES:
            if table in existing_tables:
                print(f"  ✅ {table}")
            else:
                print(f"  ❌ {table} - ОТСУТСТВУЕТ!")
                missing_tables.append(table)
        
        # Проверка лишних таблиц
        for table in existing_tables:
            if table not in EXPECTED_TABLES:
                print(f"  ⚠️  {table} - неожиданная таблица")
                extra_tables.append(table)
        
        # Проверка структуры таблиц
        print("\n" + "=" * 80)
        print("Проверка структуры таблиц:")
        print("=" * 80)
        
        structure_errors = []
        
        for table_name in EXPECTED_TABLES:
            if table_name not in existing_tables:
                continue
                
            print(f"\n📋 Таблица: {table_name}")
            expected_cols = EXPECTED_COLUMNS.get(table_name, [])
            
            if not expected_cols:
                print("  ⚠️  Нет ожидаемых колонок для проверки")
                continue
            
            columns = inspector.get_columns(table_name)
            column_names = [col['name'] for col in columns]
            
            missing_cols = []
            for col in expected_cols:
                if col in column_names:
                    print(f"  ✅ {col}")
                else:
                    print(f"  ❌ {col} - ОТСУТСТВУЕТ!")
                    missing_cols.append(col)
            
            if missing_cols:
                structure_errors.append({
                    "table": table_name,
                    "missing_columns": missing_cols
                })
        
        # Проверка внешних ключей
        print("\n" + "=" * 80)
        print("Проверка внешних ключей:")
        print("=" * 80)
        
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                ORDER BY tc.table_name, kcu.column_name;
            """))
            
            fk_count = 0
            for row in result:
                fk_count += 1
                print(f"  {row[0]}.{row[1]} → {row[2]}.{row[3]}")
            
            print(f"\n📊 Найдено внешних ключей: {fk_count}")
        
        # Итоговый отчет
        print("\n" + "=" * 80)
        print("ИТОГОВЫЙ ОТЧЕТ")
        print("=" * 80)
        
        if missing_tables:
            print(f"\n❌ Отсутствующие таблицы ({len(missing_tables)}):")
            for table in missing_tables:
                print(f"  - {table}")
        else:
            print("\n✅ Все ожидаемые таблицы присутствуют")
        
        if extra_tables:
            print(f"\n⚠️  Неожиданные таблицы ({len(extra_tables)}):")
            for table in extra_tables:
                print(f"  - {table}")
        
        if structure_errors:
            print(f"\n❌ Ошибки в структуре таблиц ({len(structure_errors)}):")
            for error in structure_errors:
                print(f"  - {error['table']}: отсутствуют колонки {', '.join(error['missing_columns'])}")
        else:
            print("\n✅ Структура таблиц соответствует ожидаемой")
        
        # Статистика
        print("\n" + "=" * 80)
        print("СТАТИСТИКА")
        print("=" * 80)
        
        with engine.connect() as conn:
            # Количество записей в основных таблицах
            for table in ["users", "accounts", "transactions", "categories"]:
                if table in existing_tables:
                    try:
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                        count = result.fetchone()[0]
                        print(f"  {table}: {count} записей")
                    except Exception as e:
                        print(f"  {table}: ошибка при подсчете - {e}")
        
        print("\n" + "=" * 80)
        
        if missing_tables or structure_errors:
            print("❌ Схема базы данных НЕ соответствует ожидаемой!")
            print("\n💡 Рекомендации:")
            if missing_tables:
                print("  1. Примените миграции: python run_migrations.py")
            if structure_errors:
                print("  2. Проверьте миграции - возможно, они не были применены полностью")
            return False
        else:
            print("✅ Схема базы данных соответствует ожидаемой!")
            return True
            
    except OperationalError as e:
        print(f"❌ Ошибка подключения к базе данных: {e}")
        return False
    except SQLAlchemyError as e:
        print(f"❌ Ошибка SQLAlchemy: {e}")
        return False
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = check_database_schema()
    sys.exit(0 if success else 1)













