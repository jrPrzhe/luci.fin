from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text as sa_text
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account
from app.models.goal import Goal, GoalStatus
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


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
    parent_transaction_id: Optional[int] = None
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
    
    logger.info(f"Getting transactions for user_id={current_user.id}, limit={limit}, offset={offset}, account_id={account_id}")
    
    # Get shared account IDs if needed (for filter_type)
    shared_account_ids = []
    if not account_id:
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
    # Use encode/decode to handle invalid UTF-8 sequences in database
    # Try to use convert_from/convert_to, but if it fails, we'll use a fallback
    sql_query = """
        SELECT 
            t.id, t.account_id, t.transaction_type::text, t.amount, t.currency,
            t.category_id, 
            CASE 
                WHEN t.description IS NOT NULL THEN 
                    COALESCE(
                        convert_from(convert_to(t.description, 'LATIN1'), 'UTF8'),
                        encode(t.description::bytea, 'escape')::text,
                        t.description
                    )
                ELSE NULL
            END as description,
            t.shared_budget_id, t.goal_id,
            t.transaction_date, t.to_account_id, t.created_at, t.updated_at, t.user_id,
            t.parent_transaction_id,
            a.shared_budget_id as account_shared_budget_id,
            CASE 
                WHEN c.name IS NOT NULL THEN 
                    COALESCE(
                        convert_from(convert_to(c.name, 'LATIN1'), 'UTF8'),
                        encode(c.name::bytea, 'escape')::text,
                        c.name
                    )
                ELSE NULL
            END as category_name,
            c.icon as category_icon,
            CASE 
                WHEN g.name IS NOT NULL THEN 
                    COALESCE(
                        convert_from(convert_to(g.name, 'LATIN1'), 'UTF8'),
                        encode(g.name::bytea, 'escape')::text,
                        g.name
                    )
                ELSE NULL
            END as goal_name
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
                # User has access, get all transactions for this account
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
        sql_query += " AND t.user_id = :user_id"
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
        logger.info(f"Executing SQL query with params: {list(params.keys())}")
        # Use bindparam to handle encoding issues
        result_rows = db.execute(sa_text(sql_query), params).fetchall()
        logger.info(f"Found {len(result_rows)} transactions for user {current_user.id}, filter={filter_type}")
    except Exception as e:
        error_str = str(e)
        # Check if it's an encoding error
        if "CharacterNotInRepertoire" in error_str or "invalid byte sequence" in error_str:
            logger.error(f"Encoding error in database data: {e}")
            # Try simpler query without encoding conversions
            try:
                simple_sql = """
                    SELECT 
                        t.id, t.account_id, t.transaction_type::text, t.amount, t.currency,
                        t.category_id, t.description, t.shared_budget_id, t.goal_id,
                        t.transaction_date, t.to_account_id, t.created_at, t.updated_at, t.user_id,
                        t.parent_transaction_id,
                        a.shared_budget_id as account_shared_budget_id,
                        c.name as category_name, c.icon as category_icon,
                        g.name as goal_name
                    FROM transactions t
                    LEFT JOIN accounts a ON t.account_id = a.id
                    LEFT JOIN categories c ON t.category_id = c.id
                    LEFT JOIN goals g ON t.goal_id = g.id
                    WHERE 1=1
                """
                # Rebuild WHERE clause from original query
                where_parts = []
                if account_id:
                    where_parts.append("t.account_id = :account_id")
                    if 'user_id' in params:
                        where_parts.append("t.user_id = :user_id")
                elif filter_type == "own":
                    where_parts.append("t.user_id = :user_id")
                elif filter_type == "shared":
                    if shared_account_ids:
                        placeholders = ','.join([f':shared_acc_{i}' for i in range(len(shared_account_ids))])
                        where_parts.append(f"t.account_id IN ({placeholders})")
                else:
                    if shared_account_ids:
                        placeholders = ','.join([f':shared_acc_{i}' for i in range(len(shared_account_ids))])
                        where_parts.append(f"(t.user_id = :user_id OR t.account_id IN ({placeholders}))")
                    else:
                        where_parts.append("t.user_id = :user_id")
                
                if transaction_type and 'transaction_type' in params:
                    where_parts.append("LOWER(t.transaction_type::text) = :transaction_type")
                if start_date and 'start_date' in params:
                    where_parts.append("t.transaction_date >= :start_date")
                if end_date and 'end_date' in params:
                    where_parts.append("t.transaction_date <= :end_date")
                
                if where_parts:
                    simple_sql += " AND " + " AND ".join(where_parts)
                simple_sql += " ORDER BY t.transaction_date DESC LIMIT :limit OFFSET :offset"
                
                logger.warning("Retrying transactions query without encoding conversions")
                result_rows = db.execute(sa_text(simple_sql), params).fetchall()
                logger.info(f"Found {len(result_rows)} transactions with fallback query")
            except Exception as e2:
                logger.error(f"Fallback query also failed: {e2}")
                logger.warning("Returning empty transactions list due to encoding error in database")
                return []
        logger.error(f"Error executing SQL query: {e}", exc_info=True)
        logger.error(f"SQL query: {sql_query[:500]}...")
        logger.error(f"Params keys: {list(params.keys())}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении транзакций: {str(e)}"
        )
    
    # Build response from raw SQL results
    result = []
    for row in result_rows:
        try:
            # Helper function to safely decode strings
            def safe_decode(value):
                if value is None:
                    return None
                if isinstance(value, bytes):
                    try:
                        return value.decode('utf-8', errors='replace')
                    except:
                        return value.decode('latin-1', errors='replace')
                if isinstance(value, str):
                    # Try to fix encoding issues
                    try:
                        value.encode('utf-8')
                        return value
                    except UnicodeEncodeError:
                        # If string has encoding issues, try to fix it
                        try:
                            return value.encode('latin-1').decode('utf-8', errors='replace')
                        except:
                            return value.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
                return value
            
            trans_dict = {
                "id": row[0],
                "account_id": row[1],
                "transaction_type": safe_decode(row[2]).lower() if row[2] else None,  # Convert to lowercase
                "amount": float(row[3]) if row[3] else 0.0,
                "currency": safe_decode(row[4]) or "USD",
                "category_id": row[5],
                "description": safe_decode(row[6]),
                "shared_budget_id": row[7],
                "goal_id": row[8],
                "transaction_date": row[9],
                "to_account_id": row[10],
                "created_at": row[11],
                "updated_at": row[12],
                "user_id": row[13],
                "parent_transaction_id": row[14],
                "is_shared": row[15] is not None if row[15] is not None else False,
                "category_name": safe_decode(row[16]),
                "category_icon": safe_decode(row[17]),
                "goal_name": safe_decode(row[18]),
            }
            
            result.append(TransactionResponse(**trans_dict))
        except Exception as e:
            logger.error(f"Error serializing transaction {row[0] if row else 'unknown'}: {e}", exc_info=True)
            logger.error(f"Row data: {row[:5] if row else 'no row'}")
            continue
    
    return result


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


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new transaction"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Creating transaction for user_id={current_user.id}, account_id={transaction_data.account_id}, type={transaction_data.transaction_type}, category_id={transaction_data.category_id}")
    
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
    
    # Note: We don't validate transaction_date against current time here
    # because users in different timezones may have local times that appear
    # to be in the future when converted to UTC. The frontend validates
    # that the transaction date is not in the future in the user's local timezone.
    
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
    
    # Validate category_id for income and expense transactions
    if transaction_type_value in ["income", "expense"]:
        if not transaction_data.category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Категория обязательна для доходов и расходов"
            )
        
        # Verify category exists and belongs to user or shared budget
        from app.models.category import Category
        category = db.query(Category).filter(Category.id == transaction_data.category_id).first()
        
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Категория не найдена"
            )
        
        # Check if category is for the correct transaction type
        if category.transaction_type.value not in ["both", transaction_type_value]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Категория не подходит для типа транзакции '{transaction_type_value}'"
            )
        
        # Check access: category must belong to user or shared budget
        has_category_access = False
        if category.user_id == current_user.id:
            has_category_access = True
        elif category.shared_budget_id:
            from app.models.shared_budget import SharedBudgetMember
            membership = db.query(SharedBudgetMember).filter(
                SharedBudgetMember.shared_budget_id == category.shared_budget_id,
                SharedBudgetMember.user_id == current_user.id
            ).first()
            has_category_access = membership is not None
        
        if not has_category_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет доступа к этой категории"
            )
    
    # Check balance for expense and transfer transactions
    if transaction_type_value in ["expense", "transfer"]:
        try:
            logger.info(f"Checking balance for {transaction_type_value} transaction, account_id={final_account_id}, user_id={current_user.id}")
            
            # Calculate current account balance
            # For shared accounts, count ALL transactions (from all members)
            # For personal accounts, count only user's transactions
            if final_account.shared_budget_id:
                # Shared account: count all transactions
                logger.info(f"Checking balance for shared account {final_account_id}")
                transactions_result = db.execute(
                    sa_text("""
                        SELECT transaction_type::text, amount 
                        FROM transactions 
                        WHERE account_id = :account_id
                    """),
                    {"account_id": final_account_id}
                )
            else:
                # Personal account: count only user's transactions
                logger.info(f"Checking balance for personal account {final_account_id}, user_id={current_user.id}")
                transactions_result = db.execute(
                    sa_text("""
                        SELECT transaction_type::text, amount 
                        FROM transactions 
                        WHERE account_id = :account_id AND user_id = :user_id
                    """),
                    {"account_id": final_account_id, "user_id": current_user.id}
                )
            
            # Calculate balance
            balance = Decimal(str(final_account.initial_balance)) if final_account.initial_balance else Decimal("0")
            logger.info(f"Initial balance: {balance}")
            
            transaction_count = 0
            for row in transactions_result:
                transaction_count += 1
                trans_type = row[0].lower() if row[0] else ''
                amount = Decimal(str(row[1])) if row[1] else Decimal("0")
                
                if trans_type == 'income':
                    balance += amount
                elif trans_type == 'expense':
                    balance -= amount
                elif trans_type == 'transfer':
                    # Transfer уменьшает баланс счета отправления
                    balance -= amount
            
            logger.info(f"Balance after {transaction_count} transactions: {balance}")
            
            # Check if balance is sufficient
            transaction_amount = Decimal(str(transaction_data.amount))
            logger.info(f"Transaction amount: {transaction_amount}, Current balance: {balance}")
            
            if balance < transaction_amount:
                logger.warning(f"Insufficient balance: {balance} < {transaction_amount}")
                # Format balance and amount for display
                balance_formatted = f"{float(balance):,.2f}".replace(',', ' ')
                amount_formatted = f"{float(transaction_amount):,.2f}".replace(',', ' ')
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недостаточно средств на счете. Текущий баланс: {balance_formatted} {final_account.currency}, требуется: {amount_formatted} {final_account.currency}"
                )
            
            logger.info(f"Balance check passed: {balance} >= {transaction_amount}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error checking balance for expense transaction: {e}", exc_info=True)
            # Re-raise the exception to prevent transaction creation if balance check fails
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при проверке баланса счета: {str(e)}"
            )
    
    # For transfers, use raw SQL to avoid enum issues completely
    if transaction_data.transaction_type == "transfer" and to_transaction:
        try:
            # Insert source transaction (transfer) using raw SQL
            source_transaction_sql = """
                INSERT INTO transactions 
                (user_id, account_id, transaction_type, amount, currency, description, transaction_date, to_account_id, shared_budget_id, goal_id)
                VALUES 
                (:user_id, :account_id, :transaction_type, :amount, :currency, :description, :transaction_date, :to_account_id, :shared_budget_id, :goal_id)
                RETURNING id, created_at, updated_at
            """
            # Get to_account for description
            to_account = db.query(Account).filter(Account.id == transaction_data.to_account_id).first()
            to_account_name = to_account.name if to_account else "счет"
            
            # Create description for transfer transaction
            # Use format similar to income transaction: "Перевод из {account.name}" or "Перевод из {account.name}: {user_description}"
            # This makes it clear that this is a transfer transaction
            if transaction_data.description and transaction_data.description.strip():
                transfer_description = f"Перевод из {final_account.name}: {transaction_data.description}"
            else:
                transfer_description = f"Перевод из {final_account.name}"
            
            source_params = {
                "user_id": current_user.id,
                "account_id": final_account_id,
                "transaction_type": "transfer",  # lowercase
                "amount": transaction_data.amount,
                "currency": transaction_data.currency or final_account.currency,
                "description": transfer_description,
                "transaction_date": transaction_data.transaction_date or datetime.utcnow(),
                "to_account_id": transaction_data.to_account_id,
                "shared_budget_id": transaction_data.shared_budget_id,
                "goal_id": transaction_data.goal_id
            }
            source_result = db.execute(sa_text(source_transaction_sql), source_params)
            source_row = source_result.first()
            source_transaction_id = source_row[0]
            source_created_at = source_row[1]
            source_updated_at = source_row[2]
            
            # Insert destination transaction (income) using raw SQL
            # Use parent_transaction_id to link it to the transfer transaction
            to_transaction_sql = """
                INSERT INTO transactions 
                (user_id, account_id, transaction_type, amount, currency, description, transaction_date, shared_budget_id, goal_id, parent_transaction_id)
                VALUES 
                (:user_id, :account_id, :transaction_type, :amount, :currency, :description, :transaction_date, :shared_budget_id, :goal_id, :parent_transaction_id)
                RETURNING id, created_at, updated_at
            """
            to_params = {
                "user_id": current_user.id,
                "account_id": transaction_data.to_account_id,
                "transaction_type": "income",  # lowercase
                "amount": transaction_data.amount,
                "currency": transaction_data.currency or account.currency,
                "description": f"Перевод из {account.name}" + (f": {transaction_data.description}" if transaction_data.description else ""),
                "transaction_date": transaction_data.transaction_date or datetime.utcnow(),
                "shared_budget_id": transaction_data.shared_budget_id,
                "goal_id": transaction_data.goal_id,
                "parent_transaction_id": source_transaction_id  # Link to transfer transaction
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
                amount=transaction_data.amount,
                currency=transaction_data.currency or final_account.currency,
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
            
            # Check for database numeric overflow errors
            error_str = str(e).lower()
            if 'numeric' in error_str or 'overflow' in error_str or 'value too large' in error_str or 'out of range' in error_str:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при создании перевода: {str(e)}"
            )
    else:
        # For non-transfer transactions, use raw SQL to avoid enum issues
        try:
            # Insert transaction using raw SQL with lowercase transaction_type
            transaction_sql = """
                INSERT INTO transactions 
                (user_id, account_id, transaction_type, amount, currency, category_id, description, transaction_date, shared_budget_id, goal_id)
                VALUES 
                (:user_id, :account_id, :transaction_type, :amount, :currency, :category_id, :description, :transaction_date, :shared_budget_id, :goal_id)
                RETURNING id, created_at, updated_at
            """
            transaction_params = {
                "user_id": current_user.id,
                "account_id": final_account_id,
                "transaction_type": transaction_type_value,  # lowercase
                "amount": transaction_data.amount,
                "currency": transaction_data.currency or final_account.currency,
                "category_id": transaction_data.category_id,
                "description": transaction_data.description,
                "transaction_date": transaction_data.transaction_date or datetime.utcnow(),
                "shared_budget_id": transaction_data.shared_budget_id,
                "goal_id": transaction_data.goal_id
            }
            result = db.execute(sa_text(transaction_sql), transaction_params)
            row = result.first()
            transaction_id = row[0]
            transaction_created_at = row[1]
            transaction_updated_at = row[2]
            
            db.commit()
            
            # Create Transaction object for response
            transaction = Transaction(
                id=transaction_id,
                user_id=current_user.id,
                account_id=final_account_id,
                transaction_type=transaction_type_value,
                amount=transaction_data.amount,
                currency=transaction_data.currency or final_account.currency,
                category_id=transaction_data.category_id,
                description=transaction_data.description,
                transaction_date=transaction_data.transaction_date or datetime.utcnow(),
                to_account_id=None,
                shared_budget_id=transaction_data.shared_budget_id,
                goal_id=transaction_data.goal_id,
                created_at=transaction_created_at,
                updated_at=transaction_updated_at
            )
            transaction.account = final_account  # Set for is_shared check
            
            logger.info(f"Transaction created: id={transaction_id}, type={transaction_type_value}")
        except Exception as e:
            logger.error(f"Error creating transaction: {e}", exc_info=True)
            db.rollback()
            
            # Check for database numeric overflow errors
            error_str = str(e).lower()
            if 'numeric' in error_str or 'overflow' in error_str or 'value too large' in error_str or 'out of range' in error_str:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99"
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при создании транзакции: {str(e)}"
            )
    
    # If transaction is on goal's account, sync goal with account balance
    if goal_account_id:
        _sync_goal_with_account(goal_account_id, current_user.id, db)
    
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
                    logger.warning(f"No pending quest found for user {current_user.id}, type {quest_type}, dates checked: {today_utc}, {transaction_date_only}")
                    # Попробуем найти любой квест этого типа на сегодня (на случай если статус не PENDING)
                    any_quest = db.query(UserDailyQuest).filter(
                        UserDailyQuest.profile_id == profile.id,
                        UserDailyQuest.quest_type == quest_type,
                        UserDailyQuest.quest_date.in_([today_utc, transaction_date_only])
                    ).first()
                    if any_quest:
                        logger.warning(f"Found quest {any_quest.id} but status is {any_quest.status}, not PENDING")
            
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
