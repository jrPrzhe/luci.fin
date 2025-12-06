#!/usr/bin/env python3
"""
Скрипт для выгрузки списка пользователей с премиум подпиской
"""
import sys
import os

# Добавляем путь к приложению
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from datetime import datetime

def list_premium_users():
    """Вывести список всех премиум пользователей"""
    db = SessionLocal()
    try:
        # Получаем всех премиум пользователей
        premium_users = db.query(User).filter(User.is_premium == True).order_by(User.id).all()
        
        print("=" * 80)
        print(f"ПРЕМИУМ ПОЛЬЗОВАТЕЛИ")
        print(f"Дата выгрузки: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        print(f"\nВсего премиум пользователей: {len(premium_users)}")
        print("=" * 80)
        
        if len(premium_users) == 0:
            print("\n❌ Премиум пользователей не найдено")
            return
        
        print("\n{:<6} | {:<30} | {:<20} | {:<15} | {:<12}".format(
            "ID", "Email", "Имя", "Telegram", "Дата регистрации"
        ))
        print("-" * 80)
        
        for user in premium_users:
            name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or "N/A"
            telegram_info = f"@{user.telegram_username}" if user.telegram_username else (user.telegram_id or "N/A")
            created_at = user.created_at.strftime('%Y-%m-%d') if user.created_at else "N/A"
            
            print("{:<6} | {:<30} | {:<20} | {:<15} | {:<12}".format(
                user.id,
                user.email[:30] if len(user.email) <= 30 else user.email[:27] + "...",
                name[:20] if len(name) <= 20 else name[:17] + "...",
                telegram_info[:15] if len(str(telegram_info)) <= 15 else str(telegram_info)[:12] + "...",
                created_at
            ))
        
        print("\n" + "=" * 80)
        print("ДЕТАЛЬНАЯ ИНФОРМАЦИЯ")
        print("=" * 80)
        
        for user in premium_users:
            print(f"\n👤 Пользователь ID: {user.id}")
            print(f"   Email: {user.email}")
            if user.username:
                print(f"   Username: {user.username}")
            if user.first_name or user.last_name:
                print(f"   Имя: {user.first_name or ''} {user.last_name or ''}".strip())
            if user.telegram_id:
                print(f"   Telegram ID: {user.telegram_id}")
            if user.telegram_username:
                print(f"   Telegram Username: @{user.telegram_username}")
            if user.vk_id:
                print(f"   VK ID: {user.vk_id}")
            print(f"   Валюта: {user.default_currency}")
            print(f"   Язык: {user.language}")
            print(f"   Дата регистрации: {user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else 'N/A'}")
            print(f"   Последний вход: {user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else 'Никогда'}")
            print(f"   Статус: {'✅ Активен' if user.is_active else '❌ Неактивен'}")
            print(f"   Верифицирован: {'✅ Да' if user.is_verified else '❌ Нет'}")
            print(f"   Админ: {'✅ Да' if user.is_admin else '❌ Нет'}")
            print(f"   Премиум: ⭐ ДА")
        
        print("\n" + "=" * 80)
        print("ЭКСПОРТ В CSV")
        print("=" * 80)
        
        # Генерируем CSV формат
        csv_lines = [
            "ID,Email,Username,First Name,Last Name,Telegram ID,Telegram Username,VK ID,Currency,Language,Created At,Last Login,Is Active,Is Verified,Is Admin,Is Premium"
        ]
        
        for user in premium_users:
            csv_lines.append(
                f"{user.id},"
                f"{user.email},"
                f"{user.username or ''},"
                f"{user.first_name or ''},"
                f"{user.last_name or ''},"
                f"{user.telegram_id or ''},"
                f"{user.telegram_username or ''},"
                f"{user.vk_id or ''},"
                f"{user.default_currency},"
                f"{user.language},"
                f"{user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else ''},"
                f"{user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else ''},"
                f"{user.is_active},"
                f"{user.is_verified},"
                f"{user.is_admin},"
                f"{user.is_premium}"
            )
        
        csv_content = "\n".join(csv_lines)
        print("\nCSV данные:")
        print(csv_content)
        
        # Сохраняем в файл
        filename = f"premium_users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(csv_content)
        
        print(f"\n✅ Данные сохранены в файл: {filename}")
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    list_premium_users()






