#!/usr/bin/env python3
"""
Скрипт для вывода списка пользователей, которые хотя бы раз заходили в систему
"""
import sys
import os
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User


def list_logged_in_users():
    """Вывести список пользователей, которые хотя бы раз заходили в систему"""
    db = SessionLocal()
    try:
        # Получаем всех пользователей, у которых last_login не NULL
        users = db.query(User).filter(User.last_login.isnot(None)).order_by(User.last_login.desc()).all()
        
        print("=" * 100)
        print(f"Пользователи, которые хотя бы раз заходили в систему: {len(users)}")
        print("=" * 100)
        print()
        
        if len(users) == 0:
            print("Нет пользователей, которые заходили в систему.")
            print("=" * 100)
            return
        
        # Заголовок таблицы
        print(f"{'ID':<5} | {'Логин (Email)':<40} | {'Username':<20} | {'Последний вход':<25}")
        print("-" * 100)
        
        # Выводим каждого пользователя
        for user in users:
            user_id = str(user.id)
            login = user.email or "N/A"
            username = user.username or "N/A"
            
            # Форматируем время последнего входа
            if user.last_login:
                # Конвертируем в локальное время, если нужно
                last_login_str = user.last_login.strftime("%Y-%m-%d %H:%M:%S UTC")
            else:
                last_login_str = "N/A"
            
            print(f"{user_id:<5} | {login:<40} | {username:<20} | {last_login_str:<25}")
        
        print("=" * 100)
        print()
        
        # Дополнительная статистика
        total_users = db.query(User).count()
        never_logged_in = db.query(User).filter(User.last_login.is_(None)).count()
        
        print("Статистика:")
        print(f"  Всего пользователей в системе: {total_users}")
        print(f"  Заходили в систему: {len(users)}")
        print(f"  Никогда не заходили: {never_logged_in}")
        print("=" * 100)
        
    finally:
        db.close()


if __name__ == "__main__":
    list_logged_in_users()























