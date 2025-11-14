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
    accounts_imported: int
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


def escape_table_name(table_name: str) -> str:
    """
    Экранирует имя таблицы для использования в SQL запросах
    """
    # В SQLite используем двойные кавычки для экранирования идентификаторов
    return f'"{table_name}"'


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
        
        accounts = []
        transactions = []
        categories = []
        
        # Словари для маппинга uid -> данные
        accounts_by_uid = {}  # uid счета -> данные счета
        categories_by_uid = {}  # uid категории -> данные категории
        transactions_by_uid = {}  # uid транзакции -> данные транзакции
        
        # Сначала парсим счета из таблицы Account (с заглавной буквы)
        account_table = None
        for table_name in ['Account', 'account', 'accounts']:
            if table_name in tables:
                account_table = table_name
                break
        
        if account_table:
            try:
                escaped_table = escape_table_name(account_table)
                cursor.execute(f"PRAGMA table_info({escaped_table})")
                columns_info = cursor.fetchall()
                columns = {col[1]: col[0] for col in columns_info}
                
                logger.info(f"Account table columns: {list(columns.keys())}")
                
                query = f"SELECT * FROM {escaped_table} WHERE isRemoved = 0"
                cursor.execute(query)
                rows = cursor.fetchall()
                
                for row in rows:
                    row_dict = dict(row)
                    
                    account_uid = None
                    account_name = None
                    account_currency = 'RUB'
                    
                    # Ищем uid счета
                    for field in ['uid', 'id', 'account_id', '_id']:
                        if field in row_dict and row_dict[field] is not None:
                            account_uid = str(row_dict[field])
                            break
                    
                    # Ищем имя счета (используем title)
                    for field in ['title', 'name', 'account_name', 'label']:
                        if field in row_dict and row_dict[field]:
                            account_name = str(row_dict[field]).strip()
                            break
                    
                    # Ищем валюту (используем currencyCode)
                    for field in ['currencyCode', 'currency_code', 'currency']:
                        if field in row_dict and row_dict[field]:
                            account_currency = str(row_dict[field]).upper()
                            break
                    
                    if account_uid and account_name:
                        account_data = {
                            'uid': account_uid,
                            'name': account_name,
                            'currency': account_currency
                        }
                        accounts.append(account_data)
                        accounts_by_uid[account_uid] = account_data
                        
                logger.info(f"Imported {len(accounts)} accounts")
            except Exception as e:
                logger.error(f"Error reading accounts from {account_table}: {e}")
        
        # Пытаемся найти таблицы с транзакциями
        # Обычные варианты: transactions, transaction, expenses, income, operations
        transaction_table = None
        for table_name in ['transactions', 'transaction', 'expenses', 'income', 'operations', 'operations_list']:
            if table_name in tables:
                transaction_table = table_name
                break
        
        if transaction_table:
            # Получаем структуру таблицы (экранируем имя таблицы)
            escaped_table = escape_table_name(transaction_table)
            cursor.execute(f"PRAGMA table_info({escaped_table})")
            columns = {row[1]: row[0] for row in cursor.fetchall()}
            
            logger.info(f"Transaction table columns: {list(columns.keys())}")
            
            # Пытаемся прочитать транзакции (экранируем имя таблицы)
            try:
                # Фильтруем удаленные транзакции
                query = f'SELECT * FROM {escaped_table} WHERE isRemoved = 0'
                cursor.execute(query)
                rows = cursor.fetchall()
                
                for row in rows:
                    row_dict = dict(row)
                    
                    # Пытаемся определить тип транзакции
                    transaction_type = None
                    amount = None
                    date = None
                    description = None
                    category_uid = None
                    account_uid = None
                    transaction_uid = None
                    
                    # Ищем uid транзакции
                    for field in ['uid', 'id', 'transaction_id', '_id']:
                        if field in row_dict and row_dict[field] is not None:
                            transaction_uid = str(row_dict[field])
                            break
                    
                    # Ищем поле amountInAccountCurrency (приоритет) или amount или sum или value
                    # ВАЖНО: amountInAccountCurrency хранится в копейках, нужно делить на 100
                    for field in ['amountInAccountCurrency', 'amountInAccount', 'amount', 'sum', 'value', 'summa', 'total']:
                        if field in row_dict and row_dict[field] is not None:
                            try:
                                amount = float(row_dict[field])
                                # Если это amountInAccountCurrency, делим на 100 (копейки -> рубли)
                                if field == 'amountInAccountCurrency':
                                    amount = amount / 100.0
                            except (ValueError, TypeError):
                                pass
                            if amount is not None:
                                break
                    
                    # Определяем тип (expense/income) - приоритет полю type
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
                    
                    # Ищем дату (приоритет полю date)
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
                                # Unix timestamp (может быть в секундах или миллисекундах)
                                timestamp = float(date_str)
                                # Если больше чем разумная дата в миллисекундах, делим на 1000
                                if timestamp > 10000000000:  # Больше чем 2001-09-09 в миллисекундах
                                    timestamp = timestamp / 1000
                                try:
                                    date = datetime.fromtimestamp(timestamp)
                                except (ValueError, OSError):
                                    # Если не удалось распарсить, используем текущую дату
                                    date = datetime.now()
                            if date:
                                break
                    
                    # Если дата не найдена, используем текущую дату
                    if not date:
                        date = datetime.now()
                    
                    # Ищем описание (приоритет полю comment)
                    for field in ['comment', 'description', 'note', 'name', 'title']:
                        if field in row_dict and row_dict[field]:
                            description = str(row_dict[field])
                            break
                    
                    # Ищем категорию отдельно
                    for field in ['category', 'category_name', 'category_id']:
                        if field in row_dict and row_dict[field]:
                            category_name = str(row_dict[field])
                            break
                    
                    if amount and amount != 0 and transaction_uid:  # Разрешаем любые суммы (включая отрицательные)
                        # Если сумма отрицательная, это расход
                        if amount < 0:
                            transaction_type = 'expense'
                            amount = abs(amount)
                        elif not transaction_type:
                            # Если тип не определен и сумма положительная, определяем по наличию знака
                            transaction_type = 'income'
                        
                        transaction_data = {
                            'uid': transaction_uid,
                            'type': transaction_type,
                            'amount': amount,
                            'date': date,
                            'description': description or '',
                            'category_uid': category_uid,
                            'account_uid': account_uid
                        }
                        transactions.append(transaction_data)
                        transactions_by_uid[transaction_uid] = transaction_data
            except Exception as e:
                logger.error(f"Error reading transactions from {transaction_table}: {e}")
        
        # Парсим категории из таблицы category
        category_table = None
        for table_name in ['category', 'categories', 'expense_categories', 'income_categories']:
            if table_name in tables:
                category_table = table_name
                break
        
        if category_table:
            try:
                # Экранируем имя таблицы
                escaped_table = escape_table_name(category_table)
                cursor.execute(f"PRAGMA table_info({escaped_table})")
                columns = {row[1]: row[0] for row in cursor.fetchall()}
                
                query = f"SELECT * FROM {escaped_table} WHERE isRemoved = 0"
                cursor.execute(query)
                rows = cursor.fetchall()
                
                for row in rows:
                    row_dict = dict(row)
                    
                    category_uid = None
                    category_name = None
                    category_type = 'both'
                    
                    # Ищем uid категории
                    for field in ['uid', 'id', 'category_id', '_id']:
                        if field in row_dict and row_dict[field] is not None:
                            category_uid = str(row_dict[field])
                            break
                    
                    # Ищем имя категории (используем title)
                    for field in ['title', 'name', 'category_name', 'label']:
                        if field in row_dict and row_dict[field]:
                            category_name = str(row_dict[field]).strip()
                            break
                    
                    # Определяем тип категории (используем type)
                    for field in ['type', 'category_type', 'transaction_type']:
                        if field in row_dict:
                            type_val = str(row_dict[field]).lower()
                            if 'expense' in type_val or 'расход' in type_val:
                                category_type = 'expense'
                            elif 'income' in type_val or 'доход' in type_val:
                                category_type = 'income'
                            break
                    
                    # Импортируем категорию, даже если имя пустое (может быть системная категория)
                    if category_uid:
                        # Если имя пустое, используем дефолтное имя
                        if not category_name or not category_name.strip():
                            category_name = f"Категория {category_uid[:8]}"
                        
                        category_data = {
                            'uid': category_uid,
                            'name': category_name.strip(),
                            'type': category_type
                        }
                        categories.append(category_data)
                        categories_by_uid[category_uid] = category_data
                        
                logger.info(f"Imported {len(categories)} categories")
            except Exception as e:
                logger.error(f"Error reading categories from {category_table}: {e}")
        
        # Используем таблицу sync_link для привязки транзакций к счетам и категориям
        if 'sync_link' in tables:
            try:
                cursor.execute('''
                    SELECT entityUid, otherType, otherUid
                    FROM sync_link
                    WHERE entityType = 'Transaction' AND isRemoved = 0
                ''')
                links = cursor.fetchall()
                
                for link in links:
                    transaction_uid = link[0]
                    other_type = link[1]
                    other_uid = link[2]
                    
                    if transaction_uid in transactions_by_uid:
                        transaction_data = transactions_by_uid[transaction_uid]
                        
                        if other_type == 'Account' and other_uid in accounts_by_uid:
                            transaction_data['account_uid'] = other_uid
                            logger.debug(f"Linked transaction {transaction_uid} to account {other_uid}")
                        elif other_type == 'Category' and other_uid in categories_by_uid:
                            transaction_data['category_uid'] = other_uid
                            logger.debug(f"Linked transaction {transaction_uid} to category {other_uid}")
                
                logger.info(f"Processed {len(links)} sync links")
            except Exception as e:
                logger.error(f"Error reading sync_link: {e}")
        
        # Обновляем транзакции с именами категорий и счетов для удобства
        for transaction in transactions:
            if transaction.get('category_uid') and transaction['category_uid'] in categories_by_uid:
                transaction['category'] = categories_by_uid[transaction['category_uid']]['name']
            if transaction.get('account_uid') and transaction['account_uid'] in accounts_by_uid:
                transaction['account'] = accounts_by_uid[transaction['account_uid']]['name']
        
        conn.close()
        
        return {
            'accounts': accounts,
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
        
        # Импортируем счета
        accounts_map = {}  # Сопоставление uid счетов из импорта к ID в нашей БД
        accounts_imported = 0
        
        for account_data in data.get('accounts', []):
            account_uid = account_data.get('uid')
            account_name = account_data.get('name')
            
            if not account_name:
                continue
            
            # Проверяем, существует ли счет с таким именем
            existing_account = db.query(Account).filter(
                Account.user_id == current_user.id,
                Account.name == account_name,
                Account.shared_budget_id.is_(None),
                Account.is_archived == False
            ).first()
            
            if existing_account:
                # Используем существующий счет
                if account_uid:
                    accounts_map[account_uid] = existing_account.id
            else:
                # Создаем новый счет
                new_account = Account(
                    user_id=current_user.id,
                    name=account_name,
                    account_type=AccountType.CASH,  # По умолчанию наличные
                    currency=account_data.get('currency', current_user.default_currency or "RUB"),
                    initial_balance=Decimal('0'),  # Баланс не импортируем, он будет рассчитан из транзакций
                    is_active=True,
                    is_archived=False
                )
                db.add(new_account)
                db.flush()
                if account_uid:
                    accounts_map[account_uid] = new_account.id
                accounts_imported += 1
                logger.info(f"Created new account: {account_name} (ID: {new_account.id})")
        
        # Получаем или создаем основной счет пользователя (если нет счетов)
        default_account = None
        if not accounts_map:
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
                    is_active=True,
                    is_archived=False
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
            # Определяем счет для транзакции через account_uid
            target_account_id = None
            account_uid = trans_data.get('account_uid')
            
            if account_uid and account_uid in accounts_map:
                target_account_id = accounts_map[account_uid]
            elif default_account:
                target_account_id = default_account.id
            elif accounts_map:
                # Используем первый доступный счет
                target_account_id = list(accounts_map.values())[0]
            else:
                # Пропускаем транзакцию, если нет счетов
                logger.warning(f"Transaction {trans_data.get('uid', 'unknown')} skipped: no account available")
                continue
            
            # Проверяем, не существует ли уже такая транзакция (по дате, сумме и описанию)
            description_value = trans_data.get('description')
            if description_value:
                description_value = description_value.strip()
                if not description_value:
                    description_value = None
            
            # Проверка дубликатов с учетом NULL значений для description
            if description_value:
                existing_transaction = db.query(Transaction).filter(
                    Transaction.user_id == current_user.id,
                    Transaction.account_id == target_account_id,
                    Transaction.amount == Decimal(str(trans_data['amount'])),
                    Transaction.transaction_date == trans_data['date'],
                    Transaction.description == description_value
                ).first()
            else:
                existing_transaction = db.query(Transaction).filter(
                    Transaction.user_id == current_user.id,
                    Transaction.account_id == target_account_id,
                    Transaction.amount == Decimal(str(trans_data['amount'])),
                    Transaction.transaction_date == trans_data['date'],
                    Transaction.description.is_(None)
                ).first()
            
            if existing_transaction:
                continue  # Пропускаем дубликаты
            
            # Определяем category_id через category_uid или category name
            category_id = None
            category_uid = trans_data.get('category_uid')
            category_name = trans_data.get('category')
            
            # Сначала пытаемся найти по uid через имя категории
            if category_uid:
                # Ищем категорию по uid в импортированных данных
                for cat_data in data.get('categories', []):
                    if cat_data.get('uid') == category_uid:
                        category_name = cat_data.get('name')
                        break
            
            # Проверяем, что category_name не пустой
            if category_name and str(category_name).strip():
                category_name = str(category_name).strip()
                category_id = categories_map.get(category_name)
            
            # Если категория не найдена, пытаемся найти или создать
            if category_name and not category_id:
                # Проверяем существующие категории
                existing_category = db.query(Category).filter(
                    Category.user_id == current_user.id,
                    Category.name == category_name,
                    Category.shared_budget_id.is_(None)
                ).first()
                
                if existing_category:
                    category_id = existing_category.id
                    categories_map[category_name] = category_id
                else:
                    # Создаем категорию
                    category_type = CategoryTransactionType.BOTH
                    if trans_data['type'] == 'expense':
                        category_type = CategoryTransactionType.EXPENSE
                    elif trans_data['type'] == 'income':
                        category_type = CategoryTransactionType.INCOME
                    
                    new_category = Category(
                        user_id=current_user.id,
                        name=category_name,
                        transaction_type=category_type,
                        is_active=True,
                        is_system=False
                    )
                    db.add(new_category)
                    db.flush()
                    category_id = new_category.id
                    categories_map[category_name] = category_id
                    categories_created += 1
                    logger.info(f"Created new category during import: {category_name} (ID: {category_id})")
            
            # Получаем валюту счета
            account = db.query(Account).filter(Account.id == target_account_id).first()
            if not account:
                continue
            
            # Создаем транзакцию
            transaction_type = TransactionType.EXPENSE
            if trans_data['type'] == 'income':
                transaction_type = TransactionType.INCOME
            
            # Обрабатываем description для создания транзакции
            transaction_description = trans_data.get('description')
            if transaction_description:
                transaction_description = transaction_description.strip()
                if not transaction_description:
                    transaction_description = None
            
            transaction = Transaction(
                user_id=current_user.id,
                account_id=target_account_id,
                transaction_type=transaction_type,
                amount=Decimal(str(trans_data['amount'])),
                currency=account.currency,
                category_id=category_id,
                description=transaction_description,
                transaction_date=trans_data['date']
            )
            db.add(transaction)
            transactions_imported += 1
        
        # Сохраняем изменения
        db.commit()
        
        return ImportResponse(
            message="Данные успешно импортированы",
            accounts_imported=accounts_imported,
            transactions_imported=transactions_imported,
            categories_imported=len(data.get('categories', [])),
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

