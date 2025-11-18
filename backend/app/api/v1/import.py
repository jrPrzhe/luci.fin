from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category, TransactionType as CategoryTransactionType
from app.models.account import Account, AccountType
from datetime import datetime
from decimal import Decimal
import sqlite3
import tempfile
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ImportResponse(BaseModel):
    message: str
    transactions_imported: int
    categories_imported: int
    categories_created: int


class ImportSource(BaseModel):
    id: str
    name: str
    description: str


@router.get("/sources", response_model=list[ImportSource])
async def get_import_sources():
    """Get list of available import sources"""
    return [
        ImportSource(
            id="myfinance",
            name="Финансы жизни",
            description="База данных MyFinance.db"
        )
    ]


def parse_myfinance_db(db_path: str, user_id: int, db: Session) -> dict:
    """
    Парсит базу данных MyFinance.db и возвращает данные для импорта
    """
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Получаем информацию о структуре базы данных
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        logger.info(f"Found tables in MyFinance.db: {tables}")
        
        transactions = []
        categories = []
        
        # Пытаемся найти таблицы с транзакциями
        # Обычные варианты: transactions, transaction, expenses, income, operations
        transaction_table = None
        for table_name in ['transactions', 'transaction', 'expenses', 'income', 'operations', 'operations_list']:
            if table_name in tables:
                transaction_table = table_name
                break
        
        if transaction_table:
            # Получаем структуру таблицы
            cursor.execute(f"PRAGMA table_info({transaction_table})")
            columns = {row[1]: row[0] for row in cursor.fetchall()}
            
            logger.info(f"Transaction table columns: {list(columns.keys())}")
            
            # Пытаемся прочитать транзакции
            try:
                query = f"SELECT * FROM {transaction_table}"
                cursor.execute(query)
                rows = cursor.fetchall()
                
                for row in rows:
                    row_dict = dict(row)
                    
                    # Пытаемся определить тип транзакции
                    transaction_type = None
                    amount = None
                    date = None
                    description = None
                    category_name = None
                    
                    # Ищем поле amount или sum или value
                    for field in ['amount', 'sum', 'value', 'summa', 'total']:
                        if field in row_dict and row_dict[field] is not None:
                            amount = float(row_dict[field])
                            break
                    
                    # Определяем тип (expense/income)
                    for field in ['type', 'operation_type', 'transaction_type', 'expense_type']:
                        if field in row_dict:
                            type_val = str(row_dict[field]).lower()
                            if 'expense' in type_val or 'расход' in type_val or 'outcome' in type_val:
                                transaction_type = 'expense'
                            elif 'income' in type_val or 'доход' in type_val:
                                transaction_type = 'income'
                            break
                    
                    # Если тип не определен, пытаемся определить по знаку суммы
                    if not transaction_type and amount:
                        if amount < 0:
                            transaction_type = 'expense'
                            amount = abs(amount)
                        else:
                            transaction_type = 'income'
                    
                    # Если всё ещё не определено, считаем расходом
                    if not transaction_type:
                        transaction_type = 'expense'
                    
                    # Ищем дату
                    for field in ['date', 'transaction_date', 'created_at', 'operation_date', 'datetime']:
                        if field in row_dict and row_dict[field]:
                            date_str = row_dict[field]
                            if isinstance(date_str, str):
                                # Пытаемся распарсить разные форматы дат
                                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d.%m.%Y %H:%M:%S', '%d.%m.%Y']:
                                    try:
                                        date = datetime.strptime(date_str, fmt)
                                        break
                                    except:
                                        continue
                            elif isinstance(date_str, (int, float)):
                                # Unix timestamp
                                date = datetime.fromtimestamp(date_str)
                            break
                    
                    # Если дата не найдена, используем текущую дату
                    if not date:
                        date = datetime.now()
                    
                    # Ищем описание
                    for field in ['description', 'comment', 'note', 'name', 'title', 'category']:
                        if field in row_dict and row_dict[field]:
                            if field == 'category':
                                category_name = str(row_dict[field])
                            else:
                                description = str(row_dict[field])
                            break
                    
                    # Ищем категорию отдельно
                    if not category_name:
                        for field in ['category', 'category_name', 'category_id']:
                            if field in row_dict and row_dict[field]:
                                category_name = str(row_dict[field])
                                break
                    
                    if amount and amount > 0:
                        transactions.append({
                            'type': transaction_type,
                            'amount': amount,
                            'date': date,
                            'description': description or '',
                            'category': category_name
                        })
            except Exception as e:
                logger.error(f"Error reading transactions from {transaction_table}: {e}")
        
        # Пытаемся найти таблицы с категориями
        category_table = None
        for table_name in ['categories', 'category', 'expense_categories', 'income_categories']:
            if table_name in tables:
                category_table = table_name
                break
        
        if category_table:
            try:
                cursor.execute(f"PRAGMA table_info({category_table})")
                columns = {row[1]: row[0] for row in cursor.fetchall()}
                
                query = f"SELECT * FROM {category_table}"
                cursor.execute(query)
                rows = cursor.fetchall()
                
                for row in rows:
                    row_dict = dict(row)
                    
                    category_name = None
                    category_type = 'both'
                    
                    # Ищем имя категории
                    for field in ['name', 'title', 'category_name', 'label']:
                        if field in row_dict and row_dict[field]:
                            category_name = str(row_dict[field])
                            break
                    
                    # Определяем тип категории
                    for field in ['type', 'category_type', 'transaction_type']:
                        if field in row_dict:
                            type_val = str(row_dict[field]).lower()
                            if 'expense' in type_val or 'расход' in type_val:
                                category_type = 'expense'
                            elif 'income' in type_val or 'доход' in type_val:
                                category_type = 'income'
                            break
                    
                    if category_name:
                        categories.append({
                            'name': category_name,
                            'type': category_type
                        })
            except Exception as e:
                logger.error(f"Error reading categories from {category_table}: {e}")
        
        conn.close()
        
        return {
            'transactions': transactions,
            'categories': categories
        }
    except Exception as e:
        logger.error(f"Error parsing MyFinance.db: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при чтении базы данных: {str(e)}"
        )


@router.post("/", response_model=ImportResponse)
async def import_data(
    source: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Импортирует данные из внешнего приложения
    """
    if source != "myfinance":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неизвестный источник импорта: {source}"
        )
    
    # Проверяем расширение файла
    if not file.filename.endswith('.db'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл должен иметь расширение .db"
        )
    
    # Сохраняем файл во временную директорию
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Парсим базу данных
        data = parse_myfinance_db(temp_path, current_user.id, db)
        
        # Получаем или создаем основной счет пользователя
        default_account = db.query(Account).filter(
            Account.user_id == current_user.id,
            Account.shared_budget_id.is_(None),
            Account.is_archived == False
        ).first()
        
        if not default_account:
            # Создаем счет по умолчанию
            default_account = Account(
                user_id=current_user.id,
                name="Основной счет",
                account_type=AccountType.CASH,
                currency=current_user.default_currency or "RUB",
                initial_balance=Decimal('0'),
                is_active=True
            )
            db.add(default_account)
            db.flush()
        
        # Импортируем категории
        categories_map = {}  # Сопоставление имен категорий к ID
        categories_created = 0
        
        for cat_data in data['categories']:
            # Проверяем, существует ли категория
            existing_category = db.query(Category).filter(
                Category.user_id == current_user.id,
                Category.name == cat_data['name'],
                Category.shared_budget_id.is_(None)
            ).first()
            
            if not existing_category:
                # Создаем категорию
                category_type = CategoryTransactionType.BOTH
                if cat_data['type'] == 'expense':
                    category_type = CategoryTransactionType.EXPENSE
                elif cat_data['type'] == 'income':
                    category_type = CategoryTransactionType.INCOME
                
                new_category = Category(
                    user_id=current_user.id,
                    name=cat_data['name'],
                    transaction_type=category_type,
                    is_active=True,
                    is_system=False
                )
                db.add(new_category)
                db.flush()
                categories_map[cat_data['name']] = new_category.id
                categories_created += 1
            else:
                categories_map[cat_data['name']] = existing_category.id
        
        # Импортируем транзакции
        transactions_imported = 0
        
        for trans_data in data['transactions']:
            # Проверяем, не существует ли уже такая транзакция (по дате, сумме и описанию)
            existing_transaction = db.query(Transaction).filter(
                Transaction.user_id == current_user.id,
                Transaction.account_id == default_account.id,
                Transaction.amount == Decimal(str(trans_data['amount'])),
                Transaction.transaction_date == trans_data['date'],
                Transaction.description == trans_data['description']
            ).first()
            
            if existing_transaction:
                continue  # Пропускаем дубликаты
            
            # Определяем category_id
            category_id = None
            if trans_data.get('category'):
                category_id = categories_map.get(trans_data['category'])
            
            # Если категория не найдена, пытаемся найти или создать
            if trans_data.get('category') and not category_id:
                # Проверяем существующие категории
                existing_category = db.query(Category).filter(
                    Category.user_id == current_user.id,
                    Category.name == trans_data['category'],
                    Category.shared_budget_id.is_(None)
                ).first()
                
                if existing_category:
                    category_id = existing_category.id
                    categories_map[trans_data['category']] = category_id
                else:
                    # Создаем категорию
                    category_type = CategoryTransactionType.BOTH
                    if trans_data['type'] == 'expense':
                        category_type = CategoryTransactionType.EXPENSE
                    elif trans_data['type'] == 'income':
                        category_type = CategoryTransactionType.INCOME
                    
                    new_category = Category(
                        user_id=current_user.id,
                        name=trans_data['category'],
                        transaction_type=category_type,
                        is_active=True,
                        is_system=False
                    )
                    db.add(new_category)
                    db.flush()
                    category_id = new_category.id
                    categories_map[trans_data['category']] = category_id
                    categories_created += 1
            
            # Создаем транзакцию
            transaction_type = TransactionType.EXPENSE
            if trans_data['type'] == 'income':
                transaction_type = TransactionType.INCOME
            
            transaction = Transaction(
                user_id=current_user.id,
                account_id=default_account.id,
                transaction_type=transaction_type,
                amount=Decimal(str(trans_data['amount'])),
                currency=default_account.currency,
                category_id=category_id,
                description=trans_data.get('description') or None,
                transaction_date=trans_data['date']
            )
            db.add(transaction)
            transactions_imported += 1
        
        # Сохраняем изменения
        db.commit()
        
        return ImportResponse(
            message="Данные успешно импортированы",
            transactions_imported=transactions_imported,
            categories_imported=len(data['categories']),
            categories_created=categories_created
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error importing data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при импорте данных: {str(e)}"
        )
    finally:
        # Удаляем временный файл
        if temp_file and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass

















