from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text as sa_text
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account
from app.models.goal import Goal, GoalStatus
from app.core.config import settings
from decimal import Decimal
import logging
import httpx
import re
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()

# Supported currencies (ISO 4217 codes)
SUPPORTED_CURRENCIES = {"USD", "RUB", "EUR", "GBP", "JPY", "CNY", "CAD", "AUD", "CHF", "NZD"}


async def get_exchange_rate(from_currency: str, to_currency: str) -> Optional[Decimal]:
    """Get exchange rate from one currency to another"""
    if from_currency == to_currency:
        return Decimal("1.0")
    
    try:
        # Try using exchangerate-api.com (free, no API key needed for basic usage)
        async with httpx.AsyncClient(timeout=5.0) as client:
            # First, get rate from base currency (USD)
            if from_currency == "USD":
                url = f"https://api.exchangerate-api.com/v4/latest/USD"
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    rates = data.get("rates", {})
                    if to_currency in rates:
                        return Decimal(str(rates[to_currency]))
            elif to_currency == "USD":
                url = f"https://api.exchangerate-api.com/v4/latest/USD"
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    rates = data.get("rates", {})
                    if from_currency in rates:
                        # Convert: 1 USD = X FROM, so 1 FROM = 1/X USD
                        rate_from_to_usd = Decimal(str(rates[from_currency]))
                        return Decimal("1.0") / rate_from_to_usd
            else:
                # Both currencies are not USD, convert through USD
                url = f"https://api.exchangerate-api.com/v4/latest/USD"
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    rates = data.get("rates", {})
                    if from_currency in rates and to_currency in rates:
                        # 1 FROM = X USD, 1 USD = Y TO, so 1 FROM = X * Y TO
                        rate_from_to_usd = Decimal(str(rates[from_currency]))
                        rate_usd_to_to = Decimal(str(rates[to_currency]))
                        return rate_usd_to_to / rate_from_to_usd
        
        logger.warning(f"Failed to get exchange rate from {from_currency} to {to_currency}")
        return None
    except Exception as e:
        logger.error(f"Error getting exchange rate: {e}", exc_info=True)
        return None


class TransactionCreate(BaseModel):
    account_id: int
    transaction_type: str  # "income", "expense", or "transfer"
    amount: float
    currency: str = "USD"
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None
    to_account_id: Optional[int] = None  # Required for transfer type
    shared_budget_id: Optional[int] = None  # Optional: link to shared budget
    goal_id: Optional[int] = None  # Optional: link to goal (for savings)
    
    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate currency code: must be 3 uppercase letters and supported"""
        if not isinstance(v, str):
            raise ValueError('Валюта должна быть строкой')
        
        # Convert to uppercase for consistency
        v_upper = v.upper().strip()
        
        # Check length (must be exactly 3 characters)
        if len(v_upper) != 3:
            raise ValueError('Код валюты должен состоять из 3 символов (например: USD, RUB)')
        
        # Check format: must be only letters
        if not re.match(r'^[A-Z]{3}$', v_upper):
            raise ValueError('Код валюты должен содержать только латинские буквы (например: USD, RUB)')
        
        # Check if currency is supported
        if v_upper not in SUPPORTED_CURRENCIES:
            supported_list = ', '.join(sorted(SUPPORTED_CURRENCIES))
            raise ValueError(f'Неподдерживаемая валюта: {v_upper}. Поддерживаемые валюты: {supported_list}')
        
        return v_upper


class TransactionUpdate(BaseModel):
    account_id: Optional[int] = None
    transaction_type: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None
    to_account_id: Optional[int] = None
    shared_budget_id: Optional[int] = None
    goal_id: Optional[int] = None
    
    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        """Validate currency code: must be 3 uppercase letters and supported"""
        if v is None:
            return None
        
        if not isinstance(v, str):
            raise ValueError('Валюта должна быть строкой')
        
        # Convert to uppercase for consistency
        v_upper = v.upper().strip()
        
        # Check length (must be exactly 3 characters)
        if len(v_upper) != 3:
            raise ValueError('Код валюты должен состоять из 3 символов (например: USD, RUB)')
        
        # Check format: must be only letters
        if not re.match(r'^[A-Z]{3}$', v_upper):
            raise ValueError('Код валюты должен содержать только латинские буквы (например: USD, RUB)')
        
        # Check if currency is supported
        if v_upper not in SUPPORTED_CURRENCIES:
            supported_list = ', '.join(sorted(SUPPORTED_CURRENCIES))
            raise ValueError(f'Неподдерживаемая валюта: {v_upper}. Поддерживаемые валюты: {supported_list}')
        
        return v_upper


class TransactionResponse(BaseModel):
    id: int
    account_id: int
    transaction_type: str
    amount: float
    currency: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    description: Optional[str] = None
    shared_budget_id: Optional[int] = None
    goal_id: Optional[int] = None
    goal_name: Optional[str] = None
    transaction_date: datetime
    to_account_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: Optional[int] = None
    is_shared: Optional[bool] = False
    
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[TransactionResponse])
async def get_transactions(
    limit: int = 50,
    offset: int = 0,
    account_id: Optional[int] = None,
    filter_type: Optional[str] = None,  # "own", "shared", or None for all
    transaction_type: Optional[str] = None,  # "income", "expense", "transfer"
    start_date: Optional[str] = None,  # ISO format date string
    end_date: Optional[str] = None,  # ISO format date string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions for current user (including shared account transactions)
    
    filter_type: "own" - only user's transactions, "shared" - only shared account transactions, None - all
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Getting transactions for user_id={current_user.id}, limit={limit}, offset={offset}, account_id={account_id}, filter_type={filter_type}")
    
    # Get shared account IDs if needed (for filter_type "shared" or "all", but NOT for "own")
    shared_account_ids = []
    if not account_id and filter_type != "own":
        from app.models.shared_budget import SharedBudgetMember
        budget_memberships = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.user_id == current_user.id
        ).all()
        budget_ids = [m.shared_budget_id for m in budget_memberships]
        
        if budget_ids:
            shared_accounts = db.query(Account).filter(
                Account.shared_budget_id.in_(budget_ids)
            ).all()
            shared_account_ids = [a.id for a in shared_accounts]
    
    # Use raw SQL to avoid enum conversion issues
    # Build SQL query based on filters
    sql_query = """
        SELECT 
            t.id, t.account_id, t.transaction_type::text, t.amount, t.currency,
            t.category_id, t.description, t.shared_budget_id, t.goal_id,
            t.transaction_date, t.to_account_id, t.created_at, t.updated_at, t.user_id,
            a.shared_budget_id as account_shared_budget_id,
            c.name as category_name, c.icon as category_icon,
            g.name as goal_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE 1=1
    """
    
    params = {}
    
    # Add filters to SQL query
    if account_id:
        # Check if account is shared and user has access
        account = db.query(Account).filter(Account.id == account_id).first()
        if account and account.shared_budget_id:
            from app.models.shared_budget import SharedBudgetMember
            membership = db.query(SharedBudgetMember).filter(
                SharedBudgetMember.shared_budget_id == account.shared_budget_id,
                SharedBudgetMember.user_id == current_user.id
            ).first()
            if membership:
                # User has access to shared account
                if filter_type == "own":
                    # For "own" filter, only show user's transactions even on shared account
                    sql_query += " AND t.account_id = :account_id AND t.user_id = :user_id"
                    params["account_id"] = account_id
                    params["user_id"] = current_user.id
                else:
                    # For "all" or "shared", get all transactions for this account
                    sql_query += " AND t.account_id = :account_id"
                    params["account_id"] = account_id
            else:
                # User doesn't have access, only their own transactions
                sql_query += " AND t.account_id = :account_id AND t.user_id = :user_id"
                params["account_id"] = account_id
                params["user_id"] = current_user.id
        else:
            # Personal account: only user's transactions
            sql_query += " AND t.account_id = :account_id AND t.user_id = :user_id"
            params["account_id"] = account_id
            params["user_id"] = current_user.id
    elif filter_type == "own":
        # Only user's transactions from personal accounts (exclude shared account transactions)
        # This means: transactions where user_id matches AND account is not shared
        sql_query += " AND t.user_id = :user_id AND a.shared_budget_id IS NULL"
        params["user_id"] = current_user.id
    elif filter_type == "shared":
        if shared_account_ids:
            # Use parameterized query for safety
            placeholders = ','.join([f':shared_acc_{i}' for i in range(len(shared_account_ids))])
            sql_query += f" AND t.account_id IN ({placeholders})"
            for i, acc_id in enumerate(shared_account_ids):
                params[f"shared_acc_{i}"] = acc_id
        else:
            sql_query += " AND 1=0"  # No results
    else:
        # All transactions
        if shared_account_ids:
            # Use parameterized query for safety
            placeholders = ','.join([f':shared_acc_{i}' for i in range(len(shared_account_ids))])
            sql_query += f" AND (t.user_id = :user_id OR t.account_id IN ({placeholders}))"
            params["user_id"] = current_user.id
            for i, acc_id in enumerate(shared_account_ids):
                params[f"shared_acc_{i}"] = acc_id
        else:
            sql_query += " AND t.user_id = :user_id"
            params["user_id"] = current_user.id
    
    if transaction_type:
        sql_query += " AND LOWER(t.transaction_type::text) = :transaction_type"
        params["transaction_type"] = transaction_type.lower()
    
    if start_date:
        try:
            if 'T' in start_date:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            else:
                start_dt = datetime.fromisoformat(start_date + 'T00:00:00')
            sql_query += " AND t.transaction_date >= :start_date"
            params["start_date"] = start_dt
        except (ValueError, AttributeError) as e:
            logger.warning(f"Invalid start_date format: {start_date}, error: {e}")
    
    if end_date:
        try:
            if 'T' in end_date:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            else:
                end_dt = datetime.fromisoformat(end_date + 'T23:59:59')
            sql_query += " AND t.transaction_date <= :end_date"
            params["end_date"] = end_dt
        except (ValueError, AttributeError) as e:
            logger.warning(f"Invalid end_date format: {end_date}, error: {e}")
    
    sql_query += " ORDER BY t.transaction_date DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    
    # Execute raw SQL query with error handling
    try:
        result_rows = db.execute(sa_text(sql_query), params).fetchall()
        logger.info(f"Found {len(result_rows)} transactions for user {current_user.id}, filter={filter_type}, limit={limit}, offset={offset}")
    except Exception as e:
        logger.error(f"Error executing transaction query for user {current_user.id}, filter={filter_type}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при загрузке транзакций. Попробуйте позже."
        )
    
    # Build response from raw SQL results
    result = []
    for row in result_rows:
        try:
            trans_dict = {
                "id": row[0],
                "account_id": row[1],
                "transaction_type": row[2].lower() if row[2] else None,  # Convert to lowercase
                "amount": float(row[3]) if row[3] else 0.0,
                "currency": row[4] or "USD",
                "category_id": row[5],
                "description": row[6],
                "shared_budget_id": row[7],
                "goal_id": row[8],
                "transaction_date": row[9],
                "to_account_id": row[10],
                "created_at": row[11],
                "updated_at": row[12],
                "user_id": row[13],
                "is_shared": row[14] is not None if row[14] is not None else False,
                "category_name": row[15],
                "category_icon": row[16],
                "goal_name": row[17],
            }
            
            result.append(TransactionResponse(**trans_dict))
        except Exception as e:
            logger.error(f"Error serializing transaction {row[0] if row else 'unknown'}: {e}", exc_info=True)
            continue
    
    return result


def _calculate_account_balance(account_id: int, user_id: int, db: Session, account: Account = None, lock: bool = False) -> Decimal:
    """Calculate current account balance based on transactions
    
    Args:
        account_id: ID of the account
        user_id: ID of the user
        db: Database session
        account: Optional account object (to avoid extra query)
        lock: If True, use SELECT FOR UPDATE to lock the account row
    """
    from sqlalchemy import text as sa_text
    
    # Lock account row if requested (for preventing race conditions)
    if lock:
        if not account:
            # Lock account row using SELECT FOR UPDATE
            account_result = db.execute(
                sa_text("""
                    SELECT id, initial_balance, currency, shared_budget_id, user_id
                    FROM accounts 
                    WHERE id = :account_id
                    FOR UPDATE
                """),
                {"account_id": account_id}
            ).first()
            if not account_result:
                return Decimal("0")
            account = Account(
                id=account_result[0],
                initial_balance=account_result[1],
                currency=account_result[2],
                shared_budget_id=account_result[3],
                user_id=account_result[4]
            )
        else:
            # Lock account row even if we have the object
            db.execute(
                sa_text("""
                    SELECT id FROM accounts 
                    WHERE id = :account_id
                    FOR UPDATE
                """),
                {"account_id": account_id}
            ).first()
    else:
        if not account:
            account = db.query(Account).filter(Account.id == account_id).first()
            if not account:
                return Decimal("0")
    
    # For shared accounts, count ALL transactions (from all members)
    # For personal accounts, count only user's transactions
    if account.shared_budget_id:
        # Shared account: count all transactions
        transactions_result = db.execute(
            sa_text("""
                SELECT transaction_type::text, amount 
                FROM transactions 
                WHERE account_id = :account_id
            """),
            {"account_id": account_id}
        )
    else:
        # Personal account: count only user's transactions
        transactions_result = db.execute(
            sa_text("""
                SELECT transaction_type::text, amount 
                FROM transactions 
                WHERE account_id = :account_id AND user_id = :user_id
            """),
            {"account_id": account_id, "user_id": user_id}
        )
    
    balance = Decimal(str(account.initial_balance)) if account.initial_balance else Decimal("0")
    for row in transactions_result:
        trans_type = row[0].lower() if row[0] else ''
        amount = Decimal(str(row[1])) if row[1] else Decimal("0")
        
        if trans_type == 'income':
            balance += amount
        elif trans_type == 'expense':
            balance -= amount
        elif trans_type == 'transfer':
            # Transfer уменьшает баланс счета отправления
            balance -= amount
    
    return balance


def _update_account_balance(account_id: int, user_id: int, db: Session):
    """Recalculate account balance based on transactions"""
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == user_id
    ).first()
    
    if not account:
        return
    
    from decimal import Decimal
    transactions = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.user_id == user_id
    ).all()
    
    balance = Decimal(str(account.initial_balance))
    for trans in transactions:
        if trans.transaction_type == TransactionType.INCOME:
            balance += Decimal(str(trans.amount))
        elif trans.transaction_type == TransactionType.EXPENSE:
            balance -= Decimal(str(trans.amount))
        elif trans.transaction_type == TransactionType.TRANSFER:
            # For transfer, decrease from source account
            balance -= Decimal(str(trans.amount))
    
    # Note: We don't update account.initial_balance here
    # The balance is calculated on-the-fly from initial_balance + transactions


def _update_goal_from_transaction(goal_id: int, transaction_type: str, amount: Decimal, user_id: int, db: Session):
    """Update goal current_amount directly from transaction (for goals without linked account)"""
    try:
        goal = db.query(Goal).filter(
            Goal.id == goal_id,
            Goal.user_id == user_id
        ).first()
        
        if not goal:
            logger.warning(f"Goal {goal_id} not found for user {user_id}")
            return
        
        if goal.status != GoalStatus.ACTIVE:
            logger.info(f"Goal {goal_id} is not active, skipping update")
            return
        
        # Update goal current_amount based on transaction type
        if transaction_type == "income":
            goal.current_amount = (goal.current_amount or Decimal(0)) + amount
        elif transaction_type == "expense":
            goal.current_amount = max(Decimal(0), (goal.current_amount or Decimal(0)) - amount)
        # For transfer, we don't update goal (transfer doesn't affect goal directly)
        
        # Ensure current_amount is not negative
        goal.current_amount = max(Decimal(0), goal.current_amount)
        
        # Update progress percentage
        if goal.target_amount and goal.target_amount > 0:
            try:
                progress = int((goal.current_amount / goal.target_amount) * 100)
                goal.progress_percentage = max(0, min(100, progress))
            except (ZeroDivisionError, TypeError) as e:
                logger.error(f"Error calculating goal progress: {e}")
                goal.progress_percentage = 0
            
            # Check if goal is completed
            was_active = goal.status == GoalStatus.ACTIVE
            if goal.current_amount >= goal.target_amount and was_active:
                goal.status = GoalStatus.COMPLETED
                goal.progress_percentage = 100
                
                # Send Telegram notification if user has telegram_id
                try:
                    from app.models.user import User
                    user = db.query(User).filter(User.id == user_id).first()
                    if user and user.telegram_id:
                        try:
                            from app.core.config import settings
                            import httpx
                            
                            if settings.TELEGRAM_BOT_TOKEN:
                                message = f"""🎉 Поздравляем! Цель достигнута!

✅ Вы успешно достигли цели: {goal.name}

💰 Накоплено: {float(goal.current_amount):,.2f} {goal.currency}
🎯 Цель: {float(goal.target_amount):,.2f} {goal.currency}

Продолжайте в том же духе! 🚀"""
                                url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
                                payload = {
                                    "chat_id": user.telegram_id,
                                    "text": message
                                }
                                
                                # Send notification in background (don't wait)
                                try:
                                    import threading
                                    def send_notification():
                                        try:
                                            with httpx.Client(timeout=10.0) as client:
                                                client.post(url, json=payload)
                                        except Exception as e:
                                            logger.error(f"Failed to send goal completion notification: {e}")
                                    
                                    thread = threading.Thread(target=send_notification)
                                    thread.daemon = True
                                    thread.start()
                                except Exception as e:
                                    logger.error(f"Error sending goal completion notification: {e}")
                        except Exception as e:
                            logger.error(f"Error preparing goal completion notification: {e}")
                except Exception as e:
                    logger.error(f"Error querying user for goal notification: {e}")
        
        # Commit the goal update
        try:
            db.commit()
            logger.info(f"Goal {goal_id} updated: current_amount={goal.current_amount}, progress={goal.progress_percentage}%")
        except Exception as e:
            db.rollback()
            logger.error(f"Error committing goal update for goal {goal_id}: {e}")
            raise
    except Exception as e:
        logger.error(f"Error in _update_goal_from_transaction for goal {goal_id}: {e}", exc_info=True)
        # Re-raise to let the caller handle it
        raise


def _sync_goal_with_account(account_id: int, user_id: int, db: Session):
    """Synchronize goal current_amount with account balance"""
    try:
        # Find goal linked to this account
        goal = db.query(Goal).filter(
            Goal.account_id == account_id,
            Goal.user_id == user_id
        ).first()
        
        if not goal:
            return
        
        # Calculate account balance
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return
        
        transactions = db.query(Transaction).filter(
            Transaction.account_id == account_id,
            Transaction.user_id == user_id
        ).all()
        
        balance = Decimal(str(account.initial_balance)) if account.initial_balance else Decimal(0)
        for trans in transactions:
            try:
                if trans.transaction_type == TransactionType.INCOME:
                    balance += Decimal(str(trans.amount)) if trans.amount else Decimal(0)
                elif trans.transaction_type == TransactionType.EXPENSE:
                    balance -= Decimal(str(trans.amount)) if trans.amount else Decimal(0)
                elif trans.transaction_type == TransactionType.TRANSFER:
                    # For transfer, decrease from source account
                    balance -= Decimal(str(trans.amount)) if trans.amount else Decimal(0)
            except Exception as e:
                logger.error(f"Error processing transaction {trans.id} in balance calculation: {e}")
                continue
        
        # Update goal current_amount and progress
        # Ensure current_amount is not negative
        goal.current_amount = max(Decimal(0), balance)
        if goal.target_amount and goal.target_amount > 0:
            try:
                # Calculate progress percentage (ensure it's between 0 and 100)
                progress = int((goal.current_amount / goal.target_amount) * 100)
                goal.progress_percentage = max(0, min(100, progress))
            except (ZeroDivisionError, TypeError) as e:
                logger.error(f"Error calculating goal progress: {e}")
                goal.progress_percentage = 0
            
            # Check if goal is completed
            was_active = goal.status == GoalStatus.ACTIVE
            if goal.current_amount >= goal.target_amount and was_active:
                goal.status = GoalStatus.COMPLETED
                goal.progress_percentage = 100
                
                # Send Telegram notification if user has telegram_id
                try:
                    from app.models.user import User
                    user = db.query(User).filter(User.id == user_id).first()
                    if user and user.telegram_id:
                        try:
                            from app.core.config import settings
                            import httpx
                            
                            if settings.TELEGRAM_BOT_TOKEN:
                                message = f"""🎉 Поздравляем! Цель достигнута!

✅ Вы успешно достигли цели: {goal.name}

💰 Накоплено: {float(goal.current_amount):,.2f} {goal.currency}
🎯 Цель: {float(goal.target_amount):,.2f} {goal.currency}

Продолжайте в том же духе! 🚀"""
                                url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
                                payload = {
                                    "chat_id": user.telegram_id,
                                    "text": message
                                }
                                
                                # Send notification in background (don't wait)
                                try:
                                    import threading
                                    def send_notification():
                                        try:
                                            with httpx.Client(timeout=10.0) as client:
                                                client.post(url, json=payload)
                                        except Exception as e:
                                            logger.error(f"Failed to send goal completion notification: {e}")
                                    
                                    thread = threading.Thread(target=send_notification)
                                    thread.daemon = True
                                    thread.start()
                                except Exception as e:
                                    logger.error(f"Error sending goal completion notification: {e}")
                        except Exception as e:
                            logger.error(f"Error preparing goal completion notification: {e}")
                except Exception as e:
                    logger.error(f"Error querying user for goal notification: {e}")
        
        # Commit the goal update
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error committing goal sync for account {account_id}: {e}")
            raise
    except Exception as e:
        logger.error(f"Error in _sync_goal_with_account for account {account_id}: {e}", exc_info=True)
        # Re-raise to let the caller handle it
        raise


def _extract_user_friendly_error(error: Exception) -> str:
    """Extract user-friendly error message without SQL details"""
    error_str = str(error)
    
    # Remove SQL query details from error message
    # Pattern: [SQL: ...] or (Background on this error...)
    import re
    
    # Remove [SQL: ...] blocks
    error_str = re.sub(r'\[SQL:.*?\]', '', error_str, flags=re.DOTALL)
    
    # Remove [parameters: ...] blocks
    error_str = re.sub(r'\[parameters:.*?\]', '', error_str, flags=re.DOTALL)
    
    # Remove (Background on this error...) blocks
    error_str = re.sub(r'\(Background on this error.*?\)', '', error_str, flags=re.DOTALL)
    
    # Extract the main error message (usually before the SQL part)
    # For psycopg2 errors, extract the error type and message
    if 'psycopg2' in error_str.lower():
        # Pattern: (psycopg2.errors.XXX) message
        match = re.search(r'\(psycopg2\.errors\.\w+\)\s*(.+)', error_str)
        if match:
            error_str = match.group(1).strip()
    
    # Clean up extra whitespace
    error_str = re.sub(r'\s+', ' ', error_str).strip()
    
    # If we still have a very long error or SQL-like content, provide generic message
    if len(error_str) > 200 or 'INSERT INTO' in error_str.upper() or 'SELECT' in error_str.upper():
        return "Ошибка при создании транзакции. Проверьте корректность введенных данных."
    
    # Return cleaned error message
    if error_str:
        return f"Ошибка при создании транзакции: {error_str}"
    else:
        return "Ошибка при создании транзакции. Проверьте корректность введенных данных."


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new transaction
    
    For transfer transactions, uses SELECT FOR UPDATE to lock accounts
    and prevent race conditions when multiple transfers happen concurrently.
    """
    import logging
    import time
    logger = logging.getLogger(__name__)
    
    logger.info(f"Creating transaction for user_id={current_user.id}, account_id={transaction_data.account_id}, type={transaction_data.transaction_type}")
    
    # Verify account belongs to user or user has access through shared budget
    account = db.query(Account).filter(Account.id == transaction_data.account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Счет не найден"
        )
    
    # Check access: either owner or member of shared budget
    has_access = False
    if account.user_id == current_user.id:
        has_access = True
    elif account.shared_budget_id:
        from app.models.shared_budget import SharedBudgetMember
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == account.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        has_access = membership is not None
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этому счету"
        )
    
    # Validate transaction type
    if transaction_data.transaction_type not in ["income", "expense", "transfer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тип транзакции должен быть 'income', 'expense' или 'transfer'"
        )
    
    # Validate amount: check for NUMERIC(15, 2) constraint
    # Maximum: 13 digits before decimal point, 2 digits after
    try:
        amount_decimal = Decimal(str(transaction_data.amount))
        
        # Check if amount is positive
        if amount_decimal <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сумма должна быть больше 0"
            )
        
        # Convert to string to check digits
        amount_str = str(amount_decimal)
        if '.' in amount_str:
            integer_part, decimal_part = amount_str.split('.')
            # Remove negative sign if present
            integer_part = integer_part.lstrip('-')
            # Check integer part (max 13 digits)
            if len(integer_part) > 13:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимум 13 цифр перед запятой (максимальная сумма: 9999999999999.99)"
                )
            # Check decimal part (max 2 digits)
            if len(decimal_part) > 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма может содержать максимум 2 знака после запятой"
                )
        else:
            # No decimal point, check integer part
            integer_part = amount_str.lstrip('-')
            if len(integer_part) > 13:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимум 13 цифр перед запятой (максимальная сумма: 9999999999999.99)"
                )
        
        # Check maximum value: 9999999999999.99
        max_amount = Decimal('9999999999999.99')
        if amount_decimal > max_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
            )
    except HTTPException:
        raise
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Некорректная сумма: {str(e)}"
        )
    
    # For transfer, verify to_account_id
    to_account = None
    if transaction_data.transaction_type == "transfer":
        if not transaction_data.to_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Необходимо указать счет получателя для перевода"
            )
        
        to_account = db.query(Account).filter(Account.id == transaction_data.to_account_id).first()
        
        if not to_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Счет получателя не найден"
            )
        
        # Check access to destination account
        has_access_to = False
        if to_account.user_id == current_user.id:
            has_access_to = True
        elif to_account.shared_budget_id:
            from app.models.shared_budget import SharedBudgetMember
            membership = db.query(SharedBudgetMember).filter(
                SharedBudgetMember.shared_budget_id == to_account.shared_budget_id,
                SharedBudgetMember.user_id == current_user.id
            ).first()
            has_access_to = membership is not None
        
        if not has_access_to:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет доступа к счету получателя"
            )
        
        if transaction_data.account_id == transaction_data.to_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Счета отправителя и получателя должны быть разными"
            )
        
        # For transfer, we'll create destination transaction using raw SQL after committing source
        # This avoids enum issues with SQLAlchemy ORM
        to_transaction = True  # Flag to indicate we need to create destination transaction
    
    # Validate shared_budget_id if provided
    shared_budget = None
    if transaction_data.shared_budget_id:
        from app.models.shared_budget import SharedBudget, SharedBudgetMember
        shared_budget = db.query(SharedBudget).filter(
            SharedBudget.id == transaction_data.shared_budget_id
        ).first()
        
        if not shared_budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Общий бюджет не найден"
            )
        
        # Check if user is a member of the shared budget
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == transaction_data.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет доступа к этому общему бюджету"
            )
    
    # Validate goal_id if provided
    goal = None
    goal_account_id = None
    if transaction_data.goal_id:
        goal = db.query(Goal).filter(
            Goal.id == transaction_data.goal_id,
            Goal.user_id == current_user.id
        ).first()
        
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Цель не найдена"
            )
        
        if goal.status != GoalStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Можно добавлять прогресс только к активным целям"
            )
        
        # Validate income amount for goals: don't allow exceeding target amount
        if transaction_data.transaction_type == "income":
            try:
                amount_decimal = Decimal(str(transaction_data.amount))
                current_amount = goal.current_amount or Decimal(0)
                target_amount = goal.target_amount or Decimal(0)
                remaining_amount = target_amount - current_amount
                
                # If goal is already reached or exceeded
                if remaining_amount <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Цель уже достигнута. Нельзя добавлять средства к завершенной цели"
                    )
                
                # If income exceeds remaining amount needed to reach goal
                if amount_decimal > remaining_amount:
                    # Format remaining amount for display (2 decimal places, remove trailing zeros if integer)
                    remaining_formatted = f"{float(remaining_amount):.2f}".rstrip('0').rstrip('.')
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Пополнение больше цели. Вы сможете пополнить только {remaining_formatted} {goal.currency}"
                    )
            except HTTPException:
                raise
            except (ValueError, TypeError) as e:
                logger.error(f"Error validating goal amount: {e}")
                # If validation fails, continue (don't block transaction)
        
        # If goal has an account, use it for the transaction
        if goal.account_id:
            goal_account_id = goal.account_id
    
    # If goal is specified and goal has account, use goal's account
    # Otherwise use provided account_id
    final_account_id = goal_account_id if goal_account_id else transaction_data.account_id
    
    # Verify the final account belongs to user
    final_account = db.query(Account).filter(Account.id == final_account_id).first()
    if not final_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Счет не найден"
        )
    
    # Check access to final account
    has_access_final = False
    if final_account.user_id == current_user.id:
        has_access_final = True
    elif final_account.shared_budget_id:
        from app.models.shared_budget import SharedBudgetMember
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == final_account.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        has_access_final = membership is not None
    
    if not has_access_final:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этому счету"
        )
    
    # Ensure transaction_type is lowercase to match enum values in DB
    # Use string value directly to ensure correct case in database
    transaction_type_value = transaction_data.transaction_type.lower()
    
    # Validate transaction_type
    if transaction_type_value not in ["income", "expense", "transfer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transaction_type: {transaction_data.transaction_type}. Must be 'income', 'expense', or 'transfer'"
        )
    
    # Currency conversion logic
    transaction_currency = transaction_data.currency or final_account.currency
    account_currency = final_account.currency
    
    # Original amount in transaction currency
    original_amount = Decimal(str(transaction_data.amount))
    converted_amount = original_amount
    exchange_rate = None
    amount_in_account_currency = original_amount
    
    # If transaction currency differs from account currency, convert
    if transaction_currency != account_currency:
        logger.info(f"Converting {original_amount} {transaction_currency} to {account_currency}")
        exchange_rate_decimal = await get_exchange_rate(transaction_currency, account_currency)
        
        if exchange_rate_decimal is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Не удалось получить курс валют для конвертации {transaction_currency} в {account_currency}. Пожалуйста, попробуйте позже."
            )
        
        exchange_rate = float(exchange_rate_decimal)
        # Convert: amount in account currency = original amount * exchange rate
        converted_amount = original_amount * exchange_rate_decimal
        amount_in_account_currency = converted_amount
        
        logger.info(f"Exchange rate {transaction_currency} -> {account_currency}: {exchange_rate}, converted amount: {converted_amount}")
    
    # Use converted amount for account operations (in account currency)
    amount_to_use = float(converted_amount)
    
    # For transfers, check if source account has sufficient balance
    # This check happens after currency conversion to ensure we're comparing in the same currency
    # CRITICAL: Use SELECT FOR UPDATE to lock accounts and prevent race conditions
    if transaction_data.transaction_type == "transfer" and to_transaction:
        # Start a transaction with proper isolation level to prevent race conditions
        # Lock both accounts in a consistent order (by ID) to prevent deadlocks
        from sqlalchemy import text as sa_text
        
        # Determine account IDs in sorted order to prevent deadlocks
        source_account_id = transaction_data.account_id
        dest_account_id = transaction_data.to_account_id
        account_ids_sorted = sorted([source_account_id, dest_account_id])
        
        # Lock both accounts in sorted order (prevents deadlocks)
        for acc_id in account_ids_sorted:
            db.execute(
                sa_text("SELECT id FROM accounts WHERE id = :account_id FOR UPDATE"),
                {"account_id": acc_id}
            ).first()
        
        # For transfers, always check the original source account (account_id), not final_account_id
        # because final_account_id might be changed if a goal is specified
        source_account = account  # Use the original account from the beginning of the function
        
        # Calculate current balance of source account (in account currency) WITH LOCK
        source_balance = _calculate_account_balance(
            transaction_data.account_id, 
            current_user.id, 
            db, 
            account=source_account,
            lock=True  # Lock account to prevent concurrent modifications
        )
        
        # For transfer, we need to check balance in the source account's currency
        # Use the already converted amount if source account currency matches final account currency
        # Otherwise, convert from transaction currency to source account currency
        source_account_currency = source_account.currency
        
        # If source account currency matches final account currency, use already converted amount
        if source_account_currency == account_currency:
            # Use the amount that was already converted for final_account
            transfer_amount_in_source_currency = Decimal(str(amount_in_account_currency))
        elif transaction_currency == source_account_currency:
            # Transaction currency matches source account currency, use original amount
            transfer_amount_in_source_currency = original_amount
        else:
            # Need to convert from transaction currency to source account currency
            source_exchange_rate = await get_exchange_rate(transaction_currency, source_account_currency)
            if source_exchange_rate is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Не удалось получить курс валют для проверки баланса. Пожалуйста, попробуйте позже."
                )
            transfer_amount_in_source_currency = original_amount * source_exchange_rate
        
        # Check if balance is sufficient
        if source_balance < transfer_amount_in_source_currency:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостаточно средств на счете. Доступно: {source_balance:.2f} {source_account_currency}, требуется: {transfer_amount_in_source_currency:.2f} {source_account_currency}"
            )
    
    # For expense transactions, check if account has sufficient balance
    # This applies to both personal and shared accounts
    # CRITICAL: For shared accounts, balance includes ALL transactions from ALL members
    if transaction_data.transaction_type == "expense":
        from sqlalchemy import text as sa_text
        
        # Lock account to prevent race conditions (same as for transfers)
        db.execute(
            sa_text("SELECT id FROM accounts WHERE id = :account_id FOR UPDATE"),
            {"account_id": final_account_id}
        ).first()
        
        # Calculate current balance (with lock)
        # For shared accounts, _calculate_account_balance includes all transactions from all members
        # For personal accounts, it includes only user's transactions
        account_balance = _calculate_account_balance(
            final_account_id,
            current_user.id,
            db,
            account=final_account,
            lock=False  # Account is already locked above
        )
        
        # Expense amount is already in account currency (amount_in_account_currency)
        expense_amount_in_account_currency = amount_in_account_currency
        
        # Check if balance is sufficient
        if account_balance < expense_amount_in_account_currency:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостаточно средств на счете. Доступно: {account_balance:.2f} {account_currency}, требуется: {expense_amount_in_account_currency:.2f} {account_currency}"
            )
    
    # For transfers, use raw SQL to avoid enum issues completely
    if transaction_data.transaction_type == "transfer" and to_transaction:
        try:
            from sqlalchemy import text as sa_text
            
            # Insert source transaction (transfer) using raw SQL
            source_transaction_sql = """
                INSERT INTO transactions 
                (user_id, account_id, transaction_type, amount, currency, description, transaction_date, to_account_id, shared_budget_id, goal_id, amount_in_default_currency, exchange_rate)
                VALUES 
                (:user_id, :account_id, :transaction_type, :amount, :currency, :description, :transaction_date, :to_account_id, :shared_budget_id, :goal_id, :amount_in_default_currency, :exchange_rate)
                RETURNING id, created_at, updated_at
            """
            source_params = {
                "user_id": current_user.id,
                "account_id": final_account_id,
                "transaction_type": "transfer",  # lowercase
                "amount": amount_to_use,  # Use converted amount in account currency
                "currency": account_currency,  # Always use account currency for amount
                "description": transaction_data.description,
                "transaction_date": transaction_data.transaction_date or datetime.utcnow(),
                "to_account_id": transaction_data.to_account_id,
                "shared_budget_id": transaction_data.shared_budget_id,
                "goal_id": transaction_data.goal_id,
                "amount_in_default_currency": float(original_amount) if transaction_currency != account_currency else None,
                "exchange_rate": exchange_rate
            }
            source_result = db.execute(sa_text(source_transaction_sql), source_params)
            source_row = source_result.first()
            source_transaction_id = source_row[0]
            source_created_at = source_row[1]
            source_updated_at = source_row[2]
            
            # Insert destination transaction (income) using raw SQL
            to_transaction_sql = """
                INSERT INTO transactions 
                (user_id, account_id, transaction_type, amount, currency, description, transaction_date, shared_budget_id, goal_id, amount_in_default_currency, exchange_rate)
                VALUES 
                (:user_id, :account_id, :transaction_type, :amount, :currency, :description, :transaction_date, :shared_budget_id, :goal_id, :amount_in_default_currency, :exchange_rate)
                RETURNING id, created_at, updated_at
            """
            # For destination account, convert to its currency if different
            to_account_currency = to_account.currency
            to_amount = Decimal(str(amount_to_use))
            to_exchange_rate = exchange_rate
            to_original_amount = float(original_amount)
            
            # If destination account has different currency, convert again
            if account_currency != to_account_currency:
                to_exchange_rate_decimal = await get_exchange_rate(account_currency, to_account_currency)
                if to_exchange_rate_decimal is not None:
                    to_amount = to_amount * to_exchange_rate_decimal
                    to_exchange_rate = float(to_exchange_rate_decimal)
                    logger.info(f"Converting transfer amount {amount_to_use} {account_currency} to {to_account_currency}: {to_amount}")
                else:
                    # Fallback: use same amount (not ideal, but better than failing)
                    logger.warning(f"Could not convert {account_currency} to {to_account_currency}, using same amount")
            
            to_params = {
                "user_id": current_user.id,
                "account_id": transaction_data.to_account_id,
                "transaction_type": "income",  # lowercase
                "amount": float(to_amount),
                "currency": to_account_currency,  # Destination account currency
                "description": f"Перевод из {account.name}" + (f": {transaction_data.description}" if transaction_data.description else ""),
                "transaction_date": transaction_data.transaction_date or datetime.utcnow(),
                "shared_budget_id": transaction_data.shared_budget_id,
                "goal_id": transaction_data.goal_id,
                "amount_in_default_currency": to_original_amount if transaction_currency != to_account_currency else None,
                "exchange_rate": to_exchange_rate
            }
            to_result = db.execute(sa_text(to_transaction_sql), to_params)
            to_row = to_result.first()
            to_transaction_id = to_row[0]
            
            db.commit()
            
            # Create Transaction object for response (source transaction)
            transaction = Transaction(
                id=source_transaction_id,
                user_id=current_user.id,
                account_id=final_account_id,
                transaction_type="transfer",
                amount=amount_to_use,  # Converted amount in account currency
                currency=account_currency,  # Account currency
                amount_in_default_currency=float(original_amount) if transaction_currency != account_currency else None,
                exchange_rate=exchange_rate,
                category_id=None,
                description=transaction_data.description,
                transaction_date=transaction_data.transaction_date or datetime.utcnow(),
                to_account_id=transaction_data.to_account_id,
                shared_budget_id=transaction_data.shared_budget_id,
                goal_id=transaction_data.goal_id,
                created_at=source_created_at,
                updated_at=source_updated_at
            )
            transaction.account = final_account  # Set for is_shared check
            
            logger.info(f"Transfer created: source transaction {source_transaction_id}, destination transaction {to_transaction_id}")
        except Exception as e:
            logger.error(f"Error creating transfer transactions: {e}", exc_info=True)
            db.rollback()
            
            # Extract error message without SQL details
            error_message = _extract_user_friendly_error(e)
            
            # Check for database numeric overflow errors
            error_str = str(e).lower()
            if 'numeric' in error_str or 'overflow' in error_str or 'value too large' in error_str or 'out of range' in error_str:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
                )
            
            # Check for string truncation errors (currency too long)
            if 'stringdata' in error_str or 'string data right truncation' in error_str or 'value too long' in error_str:
                if 'currency' in error_str or 'character varying(3)' in error_str:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Некорректная валюта. Код валюты должен состоять из 3 латинских букв (например: USD, RUB)"
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Превышена максимальная длина поля"
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_message
            )
    else:
        # For non-transfer transactions, use raw SQL to avoid enum issues
        try:
            from sqlalchemy import text as sa_text
            
            # Insert transaction using raw SQL with lowercase transaction_type
            transaction_sql = """
                INSERT INTO transactions 
                (user_id, account_id, transaction_type, amount, currency, category_id, description, transaction_date, shared_budget_id, goal_id, amount_in_default_currency, exchange_rate)
                VALUES 
                (:user_id, :account_id, :transaction_type, :amount, :currency, :category_id, :description, :transaction_date, :shared_budget_id, :goal_id, :amount_in_default_currency, :exchange_rate)
                RETURNING id, created_at, updated_at
            """
            transaction_params = {
                "user_id": current_user.id,
                "account_id": final_account_id,
                "transaction_type": transaction_type_value,  # lowercase
                "amount": amount_to_use,  # Use converted amount in account currency
                "currency": account_currency,  # Always use account currency for amount
                "category_id": transaction_data.category_id,
                "description": transaction_data.description,
                "transaction_date": transaction_data.transaction_date or datetime.utcnow(),
                "shared_budget_id": transaction_data.shared_budget_id,
                "goal_id": transaction_data.goal_id,
                "amount_in_default_currency": float(original_amount) if transaction_currency != account_currency else None,
                "exchange_rate": exchange_rate
            }
            result = db.execute(sa_text(transaction_sql), transaction_params)
            row = result.first()
            transaction_id = row[0]
            transaction_created_at = row[1]
            transaction_updated_at = row[2]
            
            db.commit()
            
            # Get transaction from database to ensure it's in session
            transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
            if not transaction:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Транзакция не была создана"
                )
            
            logger.info(f"Transaction created: id={transaction_id}, type={transaction_type_value}")
        except Exception as e:
            logger.error(f"Error creating transaction: {e}", exc_info=True)
            db.rollback()
            
            # Extract error message without SQL details
            error_message = _extract_user_friendly_error(e)
            
            # Check for database numeric overflow errors
            error_str = str(e).lower()
            if 'numeric' in error_str or 'overflow' in error_str or 'value too large' in error_str or 'out of range' in error_str:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
                )
            
            # Check for string truncation errors (currency too long)
            if 'stringdata' in error_str or 'string data right truncation' in error_str or 'value too long' in error_str:
                if 'currency' in error_str or 'character varying(3)' in error_str:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Некорректная валюта. Код валюты должен состоять из 3 латинских букв (например: USD, RUB)"
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Превышена максимальная длина поля"
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_message
            )
    
    # Update goal if specified in transaction
    if transaction_data.goal_id:
        if goal_account_id:
            # Goal has linked account: sync goal with account balance
            _sync_goal_with_account(goal_account_id, current_user.id, db)
        else:
            # Goal doesn't have linked account: update goal directly from transaction
            # Only update for income transactions (adding money to goal)
            if transaction_data.transaction_type == "income":
                try:
                    amount_decimal = Decimal(str(transaction_data.amount))
                    _update_goal_from_transaction(
                        transaction_data.goal_id,
                        transaction_data.transaction_type,
                        amount_decimal,
                        current_user.id,
                        db
                    )
                except Exception as e:
                    logger.error(f"Error updating goal {transaction_data.goal_id} from transaction: {e}", exc_info=True)
                    # Don't fail transaction creation if goal update fails
                    # But log the error for debugging
    
    # Gamification: Update streak, add XP, check achievements
    # НЕ применяем геймификацию для transfer (это не трата и не доход)
    gamification_info = {
        "level_up": False,
        "new_level": None,
        "new_achievements": []
    }
    
    if transaction_data.transaction_type != "transfer":
        try:
            from app.api.v1.gamification import (
                get_or_create_profile,
                update_streak,
                add_xp,
                check_achievements,
                XP_FOR_TRANSACTION,
                XP_FOR_STREAK,
            )
            from app.models.gamification import QuestType, QuestStatus, UserDailyQuest
            
            profile = get_or_create_profile(current_user.id, db)
            # Используем datetime.now(timezone.utc) вместо устаревшего datetime.utcnow()
            from datetime import timezone
            transaction_date = transaction.transaction_date or datetime.now(timezone.utc)
            
            # Проверяем, была ли это первая транзакция за день
            was_streak_broken = update_streak(profile, transaction_date, db)
            
            # Начисляем XP за транзакцию
            xp_amount = XP_FOR_TRANSACTION
            if profile.streak_days > 1:
                xp_amount += XP_FOR_STREAK  # Бонус за страйк
            
            xp_result = add_xp(profile, xp_amount, db)
            
            # Проверяем достижения
            new_achievements = check_achievements(profile, db)
            
            # Обновляем квесты
            # Используем текущую дату UTC для поиска квестов (квесты создаются на текущую дату)
            today_utc = datetime.now(timezone.utc).date()
            
            # Также проверяем дату транзакции (на случай если транзакция создана на другую дату)
            transaction_date_only = transaction_date.date() if isinstance(transaction_date, datetime) else transaction_date
            if isinstance(transaction_date_only, datetime):
                transaction_date_only = transaction_date_only.date()
            
            # Генерируем квесты, если их еще нет на сегодня
            from app.api.v1.gamification import generate_daily_quests
            generate_daily_quests(profile, db, current_user)
            
            quest_type_map = {
                "expense": QuestType.RECORD_EXPENSE,
                "income": QuestType.RECORD_INCOME,
            }
            quest_type = quest_type_map.get(transaction_data.transaction_type)
            
            if quest_type:
                # Ищем соответствующий квест на сегодня или на дату транзакции
                user_quest = db.query(UserDailyQuest).filter(
                    UserDailyQuest.profile_id == profile.id,
                    UserDailyQuest.quest_type == quest_type,
                    UserDailyQuest.quest_date.in_([today_utc, transaction_date_only]),
                    UserDailyQuest.status == QuestStatus.PENDING
                ).first()
                
                if user_quest:
                    logger.info(f"Found quest {user_quest.id} for user {current_user.id}, type {quest_type}, date {user_quest.quest_date}")
                    # Обновляем прогресс квеста
                    user_quest.progress = 100
                    user_quest.status = QuestStatus.COMPLETED
                    user_quest.completed_at = datetime.now(timezone.utc)
                    
                    # Начисляем награду за квест
                    logger.info(f"Awarding {user_quest.xp_reward} XP for quest completion")
                    add_xp(profile, user_quest.xp_reward, db)
                    profile.total_quests_completed += 1
                    db.commit()
                    logger.info(f"Quest {user_quest.id} marked as completed, total quests completed: {profile.total_quests_completed}")
                else:
                    # Проверяем, есть ли уже выполненный квест (это нормально при повторных транзакциях)
                    completed_quest = db.query(UserDailyQuest).filter(
                        UserDailyQuest.profile_id == profile.id,
                        UserDailyQuest.quest_type == quest_type,
                        UserDailyQuest.quest_date.in_([today_utc, transaction_date_only]),
                        UserDailyQuest.status == QuestStatus.COMPLETED
                    ).first()
                    
                    if not completed_quest:
                        # Квест не найден вообще - это может быть проблемой
                        logger.warning(f"No quest found for user {current_user.id}, type {quest_type}, dates checked: {today_utc}, {transaction_date_only}")
                    # Если квест уже COMPLETED, это нормально - не логируем предупреждение
            
            # Подготавливаем информацию о геймификации для ответа
            gamification_info = {
                "level_up": xp_result.get("level_up", False),
                "new_level": xp_result.get("new_level", profile.level),
                "new_achievements": [
                    {
                        "id": ach.id,
                        "title": ach.title,
                        "description": ach.description,
                        "icon": ach.icon,
                        "xp_reward": ach.xp_reward,
                        "rarity": ach.rarity,
                    }
                    for ach in new_achievements
                ] if new_achievements else []
            }
            
        except Exception as e:
            logger.error(f"Gamification update error: {e}", exc_info=True)
            gamification_info = {
                "level_up": False,
                "new_level": None,
                "new_achievements": []
            }
            # Не прерываем создание транзакции из-за ошибки геймификации
    
    logger.info(f"Transaction created: id={transaction.id}, user_id={transaction.user_id}, account_id={transaction.account_id}, goal_id={transaction_data.goal_id}")
    
    # Build response manually to ensure transaction_type is lowercase string
    # Get account info using raw SQL to avoid relationship loading issues
    from sqlalchemy import text as sa_text
    account_sql = "SELECT shared_budget_id FROM accounts WHERE id = :account_id"
    account_result = db.execute(sa_text(account_sql), {"account_id": transaction.account_id}).first()
    is_shared = account_result[0] is not None if account_result else False
    
    # Get category and goal names if needed
    category_name = None
    category_icon = None
    if transaction.category_id:
        cat_sql = "SELECT name, icon FROM categories WHERE id = :cat_id"
        cat_result = db.execute(sa_text(cat_sql), {"cat_id": transaction.category_id}).first()
        if cat_result:
            category_name = cat_result[0]
            category_icon = cat_result[1]
    
    goal_name = None
    if transaction.goal_id:
        goal_sql = "SELECT name FROM goals WHERE id = :goal_id"
        goal_result = db.execute(sa_text(goal_sql), {"goal_id": transaction.goal_id}).first()
        if goal_result:
            goal_name = goal_result[0]
    
    # Ensure transaction_type is lowercase string
    trans_type_str = transaction.transaction_type
    if isinstance(trans_type_str, TransactionType):
        trans_type_str = trans_type_str.value
    elif isinstance(trans_type_str, str):
        trans_type_str = trans_type_str.lower()
    else:
        trans_type_str = str(trans_type_str).lower() if trans_type_str else None
    
    response_dict = {
        "id": transaction.id,
        "account_id": transaction.account_id,
        "transaction_type": trans_type_str,
        "amount": float(transaction.amount),
        "currency": transaction.currency,
        "category_id": transaction.category_id,
        "category_name": category_name,
        "category_icon": category_icon,
        "description": transaction.description,
        "shared_budget_id": transaction.shared_budget_id,
        "goal_id": transaction.goal_id,
        "goal_name": goal_name,
        "transaction_date": transaction.transaction_date,
        "to_account_id": transaction.to_account_id,
        "created_at": transaction.created_at,
        "updated_at": transaction.updated_at,
        "user_id": transaction.user_id,
        "is_shared": is_shared,
        "gamification": gamification_info
    }
    
    return response_dict


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a transaction"""
    try:
        # First, try to find transaction by user_id
        transaction = db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id
        ).first()
        
        # If not found, check if it's a shared transaction
        if not transaction:
            transaction = db.query(Transaction).filter(
                Transaction.id == transaction_id
            ).first()
            
            if transaction:
                # Check if user has access through shared budget
                account = db.query(Account).filter(Account.id == transaction.account_id).first()
                if account and account.shared_budget_id:
                    from app.models.shared_budget import SharedBudgetMember
                    membership = db.query(SharedBudgetMember).filter(
                        SharedBudgetMember.shared_budget_id == account.shared_budget_id,
                        SharedBudgetMember.user_id == current_user.id
                    ).first()
                    if not membership:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You don't have access to this transaction"
                        )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Transaction not found"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Transaction not found"
                )
        
        # Store old values for balance recalculation
        old_account_id = transaction.account_id
        old_type = transaction.transaction_type
        old_amount = transaction.amount
        
        # Update fields
        if transaction_data.account_id is not None:
            # Check if user has access to the account (own or shared)
            account = db.query(Account).filter(
                Account.id == transaction_data.account_id
            ).first()
            
            if not account:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Счет не найден"
                )
            
            # Check access: own account or shared budget member
            has_access = False
            if account.user_id == current_user.id:
                has_access = True
            elif account.shared_budget_id:
                from app.models.shared_budget import SharedBudgetMember
                membership = db.query(SharedBudgetMember).filter(
                    SharedBudgetMember.shared_budget_id == account.shared_budget_id,
                    SharedBudgetMember.user_id == current_user.id
                ).first()
                if membership:
                    has_access = True
            
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="У вас нет доступа к этому счету"
                )
            
            transaction.account_id = transaction_data.account_id
        
        if transaction_data.transaction_type is not None:
            if transaction_data.transaction_type not in ["income", "expense", "transfer"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Тип транзакции должен быть 'income', 'expense' или 'transfer'"
                )
            transaction.transaction_type = TransactionType(transaction_data.transaction_type)
        
        if transaction_data.amount is not None:
            # Validate amount: check for NUMERIC(15, 2) constraint
            try:
                amount_decimal = Decimal(str(transaction_data.amount))
                
                # Check if amount is positive
                if amount_decimal <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Сумма должна быть больше 0"
                    )
                
                # Convert to string to check digits
                amount_str = str(amount_decimal)
                if '.' in amount_str:
                    integer_part, decimal_part = amount_str.split('.')
                    # Remove negative sign if present
                    integer_part = integer_part.lstrip('-')
                    # Check integer part (max 13 digits)
                    if len(integer_part) > 13:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Сумма слишком большая. Максимум 13 цифр перед запятой (максимальная сумма: 9999999999999.99)"
                        )
                    # Check decimal part (max 2 digits)
                    if len(decimal_part) > 2:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Сумма может содержать максимум 2 знака после запятой"
                        )
                else:
                    # No decimal point, check integer part
                    integer_part = amount_str.lstrip('-')
                    if len(integer_part) > 13:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Сумма слишком большая. Максимум 13 цифр перед запятой (максимальная сумма: 9999999999999.99)"
                        )
                
                # Check maximum value: 9999999999999.99
                max_amount = Decimal('9999999999999.99')
                if amount_decimal > max_amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
                    )
                
                transaction.amount = transaction_data.amount
            except HTTPException:
                raise
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Некорректная сумма: {str(e)}"
                )
        
        if transaction_data.goal_id is not None:
            # Handle goal changes
            if transaction_data.goal_id == 0:
                # Remove goal
                transaction.goal_id = None
            else:
                # Add/change goal
                try:
                    goal = db.query(Goal).filter(
                        Goal.id == transaction_data.goal_id,
                        Goal.user_id == current_user.id
                    ).first()
                    if goal and goal.status == GoalStatus.ACTIVE:
                        transaction.goal_id = transaction_data.goal_id
                except Exception as e:
                    logger.error(f"Error checking goal {transaction_data.goal_id}: {e}")
        
        if transaction_data.currency is not None:
            transaction.currency = transaction_data.currency
        
        if transaction_data.category_id is not None:
            transaction.category_id = transaction_data.category_id
        
        if transaction_data.description is not None:
            transaction.description = transaction_data.description
        
        if transaction_data.transaction_date is not None:
            transaction.transaction_date = transaction_data.transaction_date
        
        if transaction_data.to_account_id is not None:
            transaction.to_account_id = transaction_data.to_account_id
        
        # Commit the update
        try:
            db.commit()
            db.refresh(transaction)
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error committing transaction update: {e}")
            
            # Check for database numeric overflow errors
            error_str = str(e).lower()
            if 'numeric' in error_str or 'overflow' in error_str or 'value too large' in error_str or 'out of range' in error_str:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обновлении транзакции: {str(e)}"
            )
        
        # Sync goals with account balances if transaction affects goal accounts
        account_ids_to_sync = set()
        
        # Old account (if changed)
        if old_account_id:
            try:
                goal = db.query(Goal).filter(Goal.account_id == old_account_id).first()
                if goal and goal.user_id == current_user.id:
                    account_ids_to_sync.add(old_account_id)
            except Exception as e:
                logger.error(f"Error checking goal for old account {old_account_id}: {e}")
        
        # New account (current)
        if transaction.account_id:
            try:
                goal = db.query(Goal).filter(Goal.account_id == transaction.account_id).first()
                if goal and goal.user_id == current_user.id:
                    account_ids_to_sync.add(transaction.account_id)
            except Exception as e:
                logger.error(f"Error checking goal for account {transaction.account_id}: {e}")
        
        # Sync all affected goal accounts
        for account_id in account_ids_to_sync:
            try:
                _sync_goal_with_account(account_id, current_user.id, db)
            except Exception as e:
                logger.error(f"Error syncing goal for account {account_id}: {e}")
                # Don't fail the update if goal sync fails
        
        return TransactionResponse.model_validate(transaction)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating transaction {transaction_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the transaction"
        )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a transaction"""
    try:
        # First, try to find transaction by user_id
        transaction = db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id
        ).first()
        
        # If not found, check if it's a shared transaction
        if not transaction:
            transaction = db.query(Transaction).filter(
                Transaction.id == transaction_id
            ).first()
            
            if transaction:
                # Check if user has access through shared budget
                account = db.query(Account).filter(Account.id == transaction.account_id).first()
                if account and account.shared_budget_id:
                    from app.models.shared_budget import SharedBudgetMember
                    membership = db.query(SharedBudgetMember).filter(
                        SharedBudgetMember.shared_budget_id == account.shared_budget_id,
                        SharedBudgetMember.user_id == current_user.id
                    ).first()
                    if not membership:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You don't have access to this transaction"
                        )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Transaction not found"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Transaction not found"
                )
        
        # Store account IDs that might need goal syncing
        account_ids_to_sync = set()
        if transaction.account_id:
            try:
                goal = db.query(Goal).filter(Goal.account_id == transaction.account_id).first()
                if goal and goal.user_id == current_user.id:
                    account_ids_to_sync.add(transaction.account_id)
            except Exception as e:
                logger.error(f"Error checking goal for account {transaction.account_id}: {e}")
        
        # If it's a transfer, also delete the corresponding income transaction
        to_transaction = None
        # Compare using string value to avoid enum issues
        transaction_type_str = transaction.transaction_type.value if isinstance(transaction.transaction_type, TransactionType) else str(transaction.transaction_type).lower()
        if transaction_type_str == 'transfer' and transaction.to_account_id:
            try:
                # Check if user has access to destination account
                to_account = db.query(Account).filter(Account.id == transaction.to_account_id).first()
                has_access_to_dest = False
                if to_account:
                    if to_account.user_id == current_user.id:
                        has_access_to_dest = True
                    elif to_account.shared_budget_id:
                        from app.models.shared_budget import SharedBudgetMember
                        membership = db.query(SharedBudgetMember).filter(
                            SharedBudgetMember.shared_budget_id == to_account.shared_budget_id,
                            SharedBudgetMember.user_id == current_user.id
                        ).first()
                        if membership:
                            has_access_to_dest = True
                
                if has_access_to_dest:
                    # Find the corresponding income transaction (without user_id filter for shared accounts)
                    # Use string comparison to avoid enum issues
                    to_transaction = db.query(Transaction).filter(
                        Transaction.account_id == transaction.to_account_id,
                        Transaction.transaction_type == 'income',  # Use string value instead of enum
                        Transaction.amount == transaction.amount,
                        Transaction.transaction_date == transaction.transaction_date
                    ).first()
                    
                    if to_transaction:
                        # Check if destination account is a goal account
                        try:
                            goal = db.query(Goal).filter(Goal.account_id == transaction.to_account_id).first()
                            if goal and goal.user_id == current_user.id:
                                account_ids_to_sync.add(transaction.to_account_id)
                        except Exception as e:
                            logger.error(f"Error checking goal for to_account {transaction.to_account_id}: {e}")
                        db.delete(to_transaction)
            except Exception as e:
                logger.error(f"Error finding/deleting transfer destination transaction: {e}")
        
        # Delete the main transaction
        db.delete(transaction)
        
        # Commit the deletion
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error committing transaction deletion: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete transaction"
            )
        
        # Sync goals with account balances (after successful deletion)
        for account_id in account_ids_to_sync:
            try:
                _sync_goal_with_account(account_id, current_user.id, db)
            except Exception as e:
                logger.error(f"Error syncing goal for account {account_id}: {e}")
                # Don't fail the deletion if goal sync fails
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting transaction {transaction_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the transaction"
        )

