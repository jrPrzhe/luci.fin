#!/usr/bin/env python3
"""
Скрипт для проверки и исправления колонки is_premium в таблице users
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from sqlalchemy import inspect, text

def check_and_fix_premium_column():
    """Проверить и исправить колонку is_premium"""
    inspector = inspect(engine)
    
    print("=" * 80)
    print("ПРОВЕРКА КОЛОНКИ is_premium")
    print("=" * 80)
    
    if not inspector.has_table('users'):
        print("❌ Таблица users не найдена!")
        return
    
    columns = [col['name'] for col in inspector.get_columns('users')]
    print(f"\nТекущие колонки в таблице users: {', '.join(columns)}")
    
    if 'is_premium' not in columns:
        print("\n❌ Колонка is_premium отсутствует!")
        print("Добавляю колонку is_premium...")
        
        try:
            with engine.begin() as conn:
                # Добавляем колонку
                conn.execute(text("ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT false"))
                print("✅ Колонка is_premium добавлена")
                
                # Устанавливаем значение по умолчанию для существующих записей
                conn.execute(text("UPDATE users SET is_premium = false WHERE is_premium IS NULL"))
                print("✅ Установлено значение по умолчанию для существующих записей")
                
                # Делаем колонку NOT NULL
                conn.execute(text("ALTER TABLE users ALTER COLUMN is_premium SET NOT NULL"))
                print("✅ Колонка is_premium установлена как NOT NULL")
                
                # Устанавливаем значение по умолчанию
                conn.execute(text("ALTER TABLE users ALTER COLUMN is_premium SET DEFAULT false"))
                print("✅ Установлено значение по умолчанию для новых записей")
            
            print("\n✅ Колонка is_premium успешно добавлена и настроена!")
        except Exception as e:
            print(f"\n❌ Ошибка при добавлении колонки: {e}")
            import traceback
            traceback.print_exc()
            return
    else:
        print("\n✅ Колонка is_premium существует")
        
        # Проверяем тип данных
        for col in inspector.get_columns('users'):
            if col['name'] == 'is_premium':
                print(f"   Тип: {col['type']}")
                print(f"   Nullable: {col['nullable']}")
                print(f"   Default: {col['default']}")
    
    # Проверяем данные
    print("\n" + "=" * 80)
    print("ПРОВЕРКА ДАННЫХ")
    print("=" * 80)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE is_premium = true"))
        premium_count = result.scalar()
        print(f"\nПользователей с премиум подпиской: {premium_count}")
        
        result = conn.execute(text("SELECT COUNT(*) FROM users WHERE is_premium = false OR is_premium IS NULL"))
        non_premium_count = result.scalar()
        print(f"Пользователей без премиум подписки: {non_premium_count}")
        
        result = conn.execute(text("SELECT COUNT(*) FROM users"))
        total_count = result.scalar()
        print(f"Всего пользователей: {total_count}")
        
        # Показываем пользователей с премиум
        if premium_count > 0:
            print("\nПользователи с премиум подпиской:")
            result = conn.execute(text("SELECT id, email, telegram_username, is_premium FROM users WHERE is_premium = true"))
            for row in result:
                print(f"  ID: {row[0]}, Email: {row[1]}, Telegram: @{row[2] if row[2] else 'N/A'}, Premium: {row[3]}")
    
    print("\n" + "=" * 80)
    print("ПРОВЕРКА ЗАВЕРШЕНА")
    print("=" * 80)

if __name__ == "__main__":
    check_and_fix_premium_column()





