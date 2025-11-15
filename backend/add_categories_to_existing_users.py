#!/usr/bin/env python3
"""
Скрипт для добавления категорий по умолчанию существующим пользователям
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.category import Category, TransactionType
from app.models.user import User


DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Продукты", "icon": "🛒", "color": "#4CAF50", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
    {"name": "Транспорт", "icon": "🚗", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
    {"name": "Коммунальные услуги", "icon": "💡", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
    {"name": "Связь и интернет", "icon": "📱", "color": "#00BCD4", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Кафе и рестораны", "icon": "🍽️", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
    {"name": "Доставка еды", "icon": "🍕", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Здоровье", "icon": "🏥", "color": "#F44336", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Аптека", "icon": "💊", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Красота и уход", "icon": "💅", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Одежда", "icon": "👕", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Обувь", "icon": "👟", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Бытовая техника", "icon": "🏠", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Развлечения", "icon": "🎬", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Кино и театр", "icon": "🎭", "color": "#673AB7", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Хобби", "icon": "🎨", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Образование", "icon": "📚", "color": "#3F51B5", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Курсы", "icon": "🎓", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Подарки", "icon": "🎁", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Праздники", "icon": "🎉", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Дети", "icon": "👶", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Домашние животные", "icon": "🐾", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
    {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
]

DEFAULT_INCOME_CATEGORIES = [
    {"name": "Зарплата", "icon": "💰", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": True},
    {"name": "Премия", "icon": "🎯", "color": "#FFC107", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Фриланс", "icon": "💼", "color": "#9C27B0", "transaction_type": TransactionType.INCOME, "is_favorite": True},
    {"name": "Подработка", "icon": "⚡", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Инвестиции", "icon": "📈", "color": "#2196F3", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Дивиденды", "icon": "💹", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Подарки", "icon": "🎁", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Возврат покупки", "icon": "↩️", "color": "#00BCD4", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Кэшбэк", "icon": "💳", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
    {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.INCOME, "is_favorite": False},
]


def add_categories_to_user(user_id: int, db: Session):
    """Добавить категории по умолчанию пользователю"""
    # Проверяем, есть ли уже категории у пользователя
    existing_categories = db.query(Category).filter(
        Category.user_id == user_id,
        Category.is_system == True
    ).all()
    
    if existing_categories:
        print(f"⚠️  У пользователя {user_id} уже есть {len(existing_categories)} системных категорий")
        print(f"   Пропускаем создание категорий")
        return
    
    categories = []
    for cat_data in DEFAULT_EXPENSE_CATEGORIES + DEFAULT_INCOME_CATEGORIES:
        # Убеждаемся, что строки правильно кодированы в UTF-8
        name = str(cat_data["name"]).encode('utf-8').decode('utf-8')
        icon = str(cat_data["icon"]).encode('utf-8').decode('utf-8')
        
        categories.append(Category(
            user_id=user_id,
            name=name,
            transaction_type=cat_data["transaction_type"],
            icon=icon,
            color=cat_data["color"],
            is_system=True,
            is_active=True,
            is_favorite=cat_data.get("is_favorite", False)
        ))
    
    try:
        db.add_all(categories)
        db.commit()
        print(f"✅ Создано {len(categories)} категорий для пользователя {user_id}")
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка при создании категорий для пользователя {user_id}: {e}")
        raise


def add_categories_to_all_users():
    """Добавить категории всем пользователям без категорий"""
    print("=" * 80)
    print("Добавление категорий по умолчанию для всех пользователей")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\n📊 Найдено пользователей: {len(users)}")
        
        users_without_categories = []
        for user in users:
            category_count = db.query(Category).filter(Category.user_id == user.id).count()
            if category_count == 0:
                users_without_categories.append(user)
        
        print(f"📋 Пользователей без категорий: {len(users_without_categories)}")
        
        if not users_without_categories:
            print("\n✅ У всех пользователей уже есть категории!")
            return
        
        print("\n🔄 Создание категорий...")
        for user in users_without_categories:
            print(f"\n👤 Пользователь ID: {user.id}, Email: {user.email or 'N/A'}, Username: {user.username or 'N/A'}")
            add_categories_to_user(user.id, db)
        
        print("\n" + "=" * 80)
        print("✅ Готово! Категории добавлены всем пользователям без категорий")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Добавить категории конкретному пользователю
        user_id = int(sys.argv[1])
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print(f"❌ Пользователь с ID {user_id} не найден")
                sys.exit(1)
            
            print(f"👤 Пользователь: {user.email or user.username or f'ID {user.id}'}")
            add_categories_to_user(user_id, db)
        finally:
            db.close()
    else:
        # Добавить категории всем пользователям без категорий
        add_categories_to_all_users()





