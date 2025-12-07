from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import os
import logging
from app.core.database import get_db
from app.models.user import User
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.api.v1.auth import get_current_admin, get_current_user
from app.schemas.user import UserResponse
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


class UserStatsResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    telegram_id: Optional[str] = None
    telegram_username: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    transaction_count: int
    account_count: int
    category_count: int
    is_active: bool
    is_verified: bool
    is_premium: bool = False
    
    model_config = {"from_attributes": True}


@router.get("/users", response_model=List[UserStatsResponse])
async def get_all_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get list of all users with statistics
    Only accessible by admins
    """
    try:
        # Get all users with their statistics
        users = db.query(User).all()
        
        result = []
        for user in users:
            try:
                # Count transactions
                transaction_count = db.query(func.count(Transaction.id)).filter(
                    Transaction.user_id == user.id
                ).scalar() or 0
                
                # Count accounts
                account_count = db.query(func.count(Account.id)).filter(
                    Account.user_id == user.id
                ).scalar() or 0
                
                # Count categories
                category_count = db.query(func.count(Category.id)).filter(
                    Category.user_id == user.id
                ).scalar() or 0
                
                # Safely get is_premium field (in case migration hasn't been applied)
                is_premium = getattr(user, 'is_premium', False)
                
                result.append(UserStatsResponse(
                    id=user.id,
                    email=user.email,
                    username=user.username,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    telegram_id=user.telegram_id,
                    telegram_username=user.telegram_username,
                    created_at=user.created_at,
                    last_login=user.last_login,
                    transaction_count=transaction_count,
                    account_count=account_count,
                    category_count=category_count,
                    is_active=user.is_active,
                    is_verified=user.is_verified,
                    is_premium=is_premium
                ))
            except Exception as e:
                logger.error(f"Error processing user {user.id}: {str(e)}", exc_info=True)
                # Skip this user and continue with others
                continue
        
        return result
    except Exception as e:
        logger.error(f"Error in get_all_users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении списка пользователей: {str(e)}"
        )


@router.post("/users/{user_id}/reset", response_model=UserResponse)
async def reset_user_settings(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Reset user settings to factory defaults
    Only accessible by admins
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Get target user
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        from app.models.account import Account, AccountType
        from app.models.category import Category, TransactionType
        from app.models.shared_budget import SharedBudgetMember, SharedBudget
        
        logger.info(f"Admin {current_admin.id} resetting user {user_id} settings")
        
        # Get user's accounts first to get account IDs
        user_accounts = db.query(Account).filter(Account.user_id == target_user.id).all()
        account_ids = [acc.id for acc in user_accounts]
        accounts_count = len(account_ids)
        
        # Delete all transactions first
        transactions_count = db.query(Transaction).filter(
            Transaction.user_id == target_user.id
        ).count()
        db.query(Transaction).filter(
            Transaction.user_id == target_user.id
        ).delete(synchronize_session=False)
        logger.info(f"Deleted {transactions_count} transactions")
        
        # Delete all goals BEFORE accounts (goals have foreign key to accounts)
        from app.models.goal import Goal
        goals_count = db.query(Goal).filter(Goal.user_id == target_user.id).count()
        db.query(Goal).filter(Goal.user_id == target_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {goals_count} goals")
        
        # Delete all accounts (after goals are deleted)
        if account_ids:
            db.query(Account).filter(Account.id.in_(account_ids)).delete(synchronize_session=False)
        logger.info(f"Deleted {accounts_count} accounts")
        
        # Delete all categories
        categories_count = db.query(Category).filter(Category.user_id == target_user.id).count()
        db.query(Category).filter(Category.user_id == target_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {categories_count} categories")
        
        # Delete all tags
        from app.models.tag import Tag
        tags_count = db.query(Tag).filter(Tag.user_id == target_user.id).count()
        db.query(Tag).filter(Tag.user_id == target_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {tags_count} tags")
        
        # Delete all reports
        from app.models.report import Report
        reports_count = db.query(Report).filter(Report.user_id == target_user.id).count()
        db.query(Report).filter(Report.user_id == target_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {reports_count} reports")
        
        # Handle shared budgets
        shared_budget_members = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.user_id == target_user.id
        ).all()
        
        for member in shared_budget_members:
            budget = db.query(SharedBudget).filter(SharedBudget.id == member.shared_budget_id).first()
            if budget and budget.created_by == target_user.id:
                # If user created the budget, delete the entire budget
                db.query(SharedBudgetMember).filter(
                    SharedBudgetMember.shared_budget_id == budget.id
                ).delete()
                db.query(SharedBudget).filter(SharedBudget.id == budget.id).delete()
                logger.info(f"Deleted shared budget {budget.id} (user was creator)")
            else:
                # Just remove user from the budget
                db.delete(member)
                logger.info(f"Removed user from shared budget {member.shared_budget_id}")
        
        # Reset user settings to defaults (but keep authentication data)
        target_user.first_name = None
        target_user.last_name = None
        target_user.timezone = "UTC"
        target_user.default_currency = "RUB" if target_user.telegram_id else "USD"
        target_user.language = "en"
        target_user.is_2fa_enabled = False
        target_user.two_factor_secret = None
        target_user.backup_codes = None
        
        # Commit all deletions first
        db.commit()
        logger.info("All deletions committed")
        
        # Create default account
        default_account = Account(
            user_id=target_user.id,
            name="Основной счёт",
            account_type=AccountType.CASH,
            currency=target_user.default_currency,
            initial_balance=0.0,
            is_active=True,
            description="Автоматически созданный счёт"
        )
        db.add(default_account)
        db.flush()
        logger.info(f"Created default account: {default_account.name}")
        
        # Create default categories
        DEFAULT_EXPENSE_CATEGORIES = [
            {"name": "Продукты", "icon": "🛒", "color": "#3390EC"},
            {"name": "Транспорт", "icon": "🚗", "color": "#4CAF50"},
            {"name": "Жильё", "icon": "🏠", "color": "#FF9800"},
            {"name": "Рестораны", "icon": "🍔", "color": "#9C27B0"},
            {"name": "Здоровье", "icon": "💊", "color": "#F44336"},
            {"name": "Развлечения", "icon": "🎮", "color": "#00BCD4"},
        ]
        
        DEFAULT_INCOME_CATEGORIES = [
            {"name": "Зарплата", "icon": "💰", "color": "#4CAF50"},
            {"name": "Подарки", "icon": "🎁", "color": "#E91E63"},
            {"name": "Инвестиции", "icon": "📈", "color": "#2196F3"},
        ]
        
        for cat_data in DEFAULT_EXPENSE_CATEGORIES:
            category = Category(
                user_id=target_user.id,
                name=cat_data["name"],
                transaction_type=TransactionType.EXPENSE,
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_default=True
            )
            db.add(category)
        
        for cat_data in DEFAULT_INCOME_CATEGORIES:
            category = Category(
                user_id=target_user.id,
                name=cat_data["name"],
                transaction_type=TransactionType.INCOME,
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_default=True
            )
            db.add(category)
        
        db.commit()
        db.refresh(target_user)
        
        logger.info(f"Successfully reset user {user_id} settings")
        return UserResponse.model_validate(target_user)
        
    except Exception as e:
        logger.error(f"Error resetting user settings: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting user settings: {str(e)}"
        )


class UpdatePremiumRequest(BaseModel):
    is_premium: bool


@router.patch("/users/{user_id}/premium", response_model=UserResponse)
async def update_user_premium(
    user_id: int,
    request: UpdatePremiumRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Update premium status for a user.
    Only accessible by admins.
    """
    try:
        logger.info(f"Admin {current_admin.id} updating premium status for user {user_id} to {request.is_premium}")
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Проверяем, существует ли столбец is_premium в базе данных
        from sqlalchemy import inspect, text
        from app.core.database import engine
        
        inspector = inspect(engine)
        if inspector.has_table('users'):
            columns = [col['name'] for col in inspector.get_columns('users')]
            if 'is_premium' not in columns:
                logger.warning(f"Column is_premium not found in users table. Adding it automatically...")
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT false"))
                        conn.execute(text("UPDATE users SET is_premium = false WHERE is_premium IS NULL"))
                        conn.execute(text("ALTER TABLE users ALTER COLUMN is_premium SET NOT NULL"))
                        conn.execute(text("ALTER TABLE users ALTER COLUMN is_premium SET DEFAULT false"))
                    logger.info(f"Column is_premium successfully added to users table")
                    # Перезагружаем пользователя после добавления столбца
                    db.refresh(user)
                except Exception as e:
                    logger.error(f"Failed to add is_premium column: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database schema error: failed to add is_premium column. {str(e)}"
                    )
        
        # Логируем текущее значение
        # Пытаемся получить значение через SQL, если атрибут недоступен
        try:
            old_value = getattr(user, 'is_premium', None)
            # Если значение None, пробуем прочитать из БД
            if old_value is None:
                result = db.execute(text("SELECT is_premium FROM users WHERE id = :user_id"), {"user_id": user_id})
                row = result.first()
                old_value = row[0] if row else False
                # Устанавливаем значение в объект
                user.is_premium = old_value
        except (AttributeError, Exception) as e:
            # Если не удалось прочитать через атрибут, читаем напрямую из БД
            logger.warning(f"Could not read is_premium attribute, reading from DB directly: {e}")
            result = db.execute(text("SELECT is_premium FROM users WHERE id = :user_id"), {"user_id": user_id})
            row = result.first()
            old_value = row[0] if row else False
            # Устанавливаем значение в объект
            user.is_premium = old_value
        
        logger.info(f"User {user_id} current is_premium: {old_value}, new value: {request.is_premium}")
        
        # Обновляем значение
        user.is_premium = request.is_premium
        
        # Сохраняем изменения
        db.commit()
        
        # Обновляем объект из БД
        db.refresh(user)
        
        # Проверяем, что значение сохранилось
        saved_value = getattr(user, 'is_premium', None)
        logger.info(f"User {user_id} premium status saved: is_premium={saved_value}")
        
        if saved_value != request.is_premium:
            logger.error(f"CRITICAL: Value mismatch! Expected {request.is_premium}, got {saved_value}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save premium status. Expected {request.is_premium}, got {saved_value}"
            )
        
        logger.info(f"Successfully updated premium status for user {user_id}: is_premium={user.is_premium}")
        
        # Отправляем уведомление о премиум, если статус был изменен на True
        if request.is_premium and old_value != request.is_premium:
            try:
                from app.services.premium import send_premium_notification
                import threading
                
                # Отправляем уведомление в фоне (не блокируем ответ)
                def send_notification():
                    try:
                        send_premium_notification(user)
                    except Exception as e:
                        logger.error(f"Failed to send premium notification in background: {e}")
                
                thread = threading.Thread(target=send_notification)
                thread.daemon = True
                thread.start()
            except Exception as e:
                logger.error(f"Failed to start premium notification thread: {e}", exc_info=True)
                # Не прерываем выполнение, если уведомление не отправилось
        
        return UserResponse.model_validate(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating premium status for user {user_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating premium status: {str(e)}"
        )


@router.get("/sync-admin-status")
@router.post("/sync-admin-status")
async def sync_admin_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync admin status for current user based on ADMIN_TELEGRAM_USERNAMES
    This endpoint can be called by any authenticated user to update their admin status
    """
    import logging
    from app.core.config import settings
    
    logger = logging.getLogger(__name__)
    
    if not current_user.telegram_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for Telegram users with username"
        )
    
    username_lower = current_user.telegram_username.lower().lstrip('@')
    should_be_admin = username_lower in settings.ADMIN_TELEGRAM_USERNAMES
    
    logger.info(f"Syncing admin status for user {current_user.id}, telegram_username={current_user.telegram_username}, should_be_admin={should_be_admin}, current_is_admin={current_user.is_admin}")
    
    if current_user.is_admin != should_be_admin:
        current_user.is_admin = should_be_admin
        db.commit()
        db.refresh(current_user)
        logger.info(f"Updated admin status for user {current_user.id}: is_admin={should_be_admin}")
    
    return {
        "is_admin": current_user.is_admin,
        "telegram_username": current_user.telegram_username,
        "in_admin_list": should_be_admin,
        "admin_list": settings.ADMIN_TELEGRAM_USERNAMES
    }


class SetAdminByUsernameRequest(BaseModel):
    telegram_username: str


@router.post("/set-admin-by-username", response_model=UserResponse)
async def set_admin_by_username(
    request: SetAdminByUsernameRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Set admin status for user by Telegram username
    Only accessible by admins
    """
    import logging
    from app.core.config import settings
    
    logger = logging.getLogger(__name__)
    
    # Remove @ if present
    username = request.telegram_username.lstrip('@')
    
    # Find user by telegram_username
    target_user = db.query(User).filter(
        User.telegram_username == username
    ).first()
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with Telegram username @{username} not found"
        )
    
    if not target_user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User @{username} does not have telegram_id"
        )
    
    logger.info(f"Admin {current_admin.id} setting admin status for user @{username} (ID: {target_user.id}, telegram_id: {target_user.telegram_id})")
    
    # Set admin status
    target_user.is_admin = True
    db.commit()
    db.refresh(target_user)
    
    # Also add to ADMIN_TELEGRAM_IDS if not already there
    admin_ids = settings.ADMIN_TELEGRAM_IDS if isinstance(settings.ADMIN_TELEGRAM_IDS, list) else []
    telegram_id_str = str(target_user.telegram_id)
    
    if telegram_id_str not in admin_ids:
        logger.info(f"Note: User's telegram_id {telegram_id_str} should be added to ADMIN_TELEGRAM_IDS environment variable for automatic sync")
    
    logger.info(f"Successfully set admin status for user @{username} (ID: {target_user.id})")
    return UserResponse.model_validate(target_user)


@router.post("/restore-admin-access", response_model=dict)
async def restore_admin_access(
    request: SetAdminByUsernameRequest,
    secret_key: str,
    db: Session = Depends(get_db)
):
    """
    Emergency endpoint to restore admin access by username
    Requires secret key to prevent unauthorized access
    Use this if all admins lost access
    """
    import logging
    from app.core.config import settings
    
    logger = logging.getLogger(__name__)
    
    # Simple secret key check (should match SECRET_KEY or a special restore key)
    # In production, set RESTORE_ADMIN_SECRET in environment
    restore_secret = os.getenv("RESTORE_ADMIN_SECRET", settings.SECRET_KEY)
    
    if secret_key != restore_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid secret key"
        )
    
    # Remove @ if present
    username = request.telegram_username.lstrip('@')
    
    # Find user by telegram_username
    target_user = db.query(User).filter(
        User.telegram_username == username
    ).first()
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with Telegram username @{username} not found"
        )
    
    if not target_user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User @{username} does not have telegram_id"
        )
    
    logger.warning(f"EMERGENCY: Restoring admin access for user @{username} (ID: {target_user.id}, telegram_id: {target_user.telegram_id})")
    
    # Set admin status
    target_user.is_admin = True
    db.commit()
    db.refresh(target_user)
    
    # Return info about ADMIN_TELEGRAM_IDS
    admin_ids = settings.ADMIN_TELEGRAM_IDS if isinstance(settings.ADMIN_TELEGRAM_IDS, list) else []
    telegram_id_str = str(target_user.telegram_id)
    
    return {
        "success": True,
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "telegram_username": target_user.telegram_username,
            "telegram_id": target_user.telegram_id,
            "is_admin": target_user.is_admin
        },
        "message": f"Admin access restored for @{username}",
        "note": f"Add telegram_id '{telegram_id_str}' to ADMIN_TELEGRAM_IDS in Railway for automatic sync",
        "current_admin_ids": admin_ids
    }
