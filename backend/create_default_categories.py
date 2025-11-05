"""
Script to create default categories for a user
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


def create_default_categories_for_user(user_id: int, db: Session):
    """Create default categories for a user"""
    # Check if user already has categories
    existing_count = db.query(Category).filter(Category.user_id == user_id).count()
    if existing_count > 0:
        print(f"User {user_id} already has categories. Skipping...")
        return
    
    categories_to_create = []
    
    # Add expense categories
    for cat_data in DEFAULT_EXPENSE_CATEGORIES:
        categories_to_create.append(Category(
            user_id=user_id,
            name=cat_data["name"],
            transaction_type=cat_data["transaction_type"],
            icon=cat_data["icon"],
            color=cat_data["color"],
            is_system=True,
            is_active=True,
            is_favorite=cat_data.get("is_favorite", False)
        ))
    
    # Add income categories
    for cat_data in DEFAULT_INCOME_CATEGORIES:
        categories_to_create.append(Category(
            user_id=user_id,
            name=cat_data["name"],
            transaction_type=cat_data["transaction_type"],
            icon=cat_data["icon"],
            color=cat_data["color"],
            is_system=True,
            is_active=True,
            is_favorite=cat_data.get("is_favorite", False)
        ))
    
    db.bulk_save_objects(categories_to_create)
    db.commit()
    
    print(f"Created {len(categories_to_create)} default categories for user {user_id}")


def create_default_categories_for_all_users():
    """Create default categories for all users without categories"""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            create_default_categories_for_user(user.id, db)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        user_id = int(sys.argv[1])
        db = SessionLocal()
        try:
            create_default_categories_for_user(user_id, db)
        finally:
            db.close()
    else:
        create_default_categories_for_all_users()

