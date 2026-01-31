from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Literal
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.api.v1.auth import get_current_admin, get_current_user
from app.schemas.user import UserResponse
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])


class UserStatsResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    telegram_id: Optional[str] = None
    telegram_username: Optional[str] = None
    vk_id: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    transaction_count: int
    account_count: int
    category_count: int
    is_active: bool
    is_verified: bool
    is_premium: bool = False
    
    model_config = {"from_attributes": True}


class UsersStatsPage(BaseModel):
    items: List[UserStatsResponse]
    total: int
    page: int
    per_page: int


class PremiumUpdateRequest(BaseModel):
    is_premium: bool


@router.get("/users", response_model=UsersStatsPage)
async def get_all_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    page: int = 1,
    per_page: int = 20,
    sort: Literal["name", "created_at", "last_login"] = "created_at",
    direction: Literal["asc", "desc"] = "desc",
):
    """
    Get list of all users with statistics
    Only accessible by admins
    """
    page = max(page, 1)
    per_page = max(1, min(per_page, 100))

    transaction_counts = db.query(
        Transaction.user_id.label("user_id"),
        func.count(Transaction.id).label("transaction_count")
    ).group_by(Transaction.user_id).subquery()

    account_counts = db.query(
        Account.user_id.label("user_id"),
        func.count(Account.id).label("account_count")
    ).group_by(Account.user_id).subquery()

    category_counts = db.query(
        Category.user_id.label("user_id"),
        func.count(Category.id).label("category_count")
    ).group_by(Category.user_id).subquery()

    total = db.query(func.count(User.id)).scalar() or 0

    query = db.query(
        User,
        func.coalesce(transaction_counts.c.transaction_count, 0).label("transaction_count"),
        func.coalesce(account_counts.c.account_count, 0).label("account_count"),
        func.coalesce(category_counts.c.category_count, 0).label("category_count"),
    ).outerjoin(
        transaction_counts, transaction_counts.c.user_id == User.id
    ).outerjoin(
        account_counts, account_counts.c.user_id == User.id
    ).outerjoin(
        category_counts, category_counts.c.user_id == User.id
    )

    if sort == "name":
        sort_expr = func.lower(func.coalesce(User.first_name, User.last_name, User.username, User.email))
    elif sort == "last_login":
        sort_expr = User.last_login
    else:
        sort_expr = User.created_at

    if direction == "asc":
        query = query.order_by(sort_expr.asc().nulls_last())
    else:
        query = query.order_by(sort_expr.desc().nulls_last())

    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for user, transaction_count, account_count, category_count in rows:
        items.append(UserStatsResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            telegram_id=user.telegram_id,
            telegram_username=user.telegram_username,
            vk_id=user.vk_id,
            created_at=user.created_at,
            last_login=user.last_login,
            transaction_count=transaction_count or 0,
            account_count=account_count or 0,
            category_count=category_count or 0,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_premium=user.is_premium if hasattr(user, 'is_premium') else False
        ))

    return UsersStatsPage(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
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
        
        # Commit transaction deletion to ensure it's applied before deleting categories
        # This prevents foreign key constraint violations
        db.commit()
        logger.info("Transaction deletions committed")
        
        # Delete all goals BEFORE accounts (goals have foreign key to accounts)
        from app.models.goal import Goal
        goals_count = db.query(Goal).filter(Goal.user_id == target_user.id).count()
        db.query(Goal).filter(Goal.user_id == target_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {goals_count} goals")
        
        # Delete all accounts (after goals are deleted)
        if account_ids:
            db.query(Account).filter(Account.id.in_(account_ids)).delete(synchronize_session=False)
        logger.info(f"Deleted {accounts_count} accounts")
        
        # Before deleting categories, ensure no transactions reference them
        # Update any remaining transactions to set category_id to NULL
        # (This is a safety measure in case some transactions weren't deleted)
        remaining_transactions = db.query(Transaction).filter(
            Transaction.category_id.in_(
                db.query(Category.id).filter(Category.user_id == target_user.id)
            )
        ).all()
        if remaining_transactions:
            logger.warning(f"Found {len(remaining_transactions)} transactions still referencing categories, setting category_id to NULL")
            for trans in remaining_transactions:
                trans.category_id = None
            db.flush()
        
        # Delete all categories (now safe since transactions are deleted or have NULL category_id)
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
            # Convert enum to string value to avoid type mismatch
            category = Category(
                user_id=target_user.id,
                name=cat_data["name"],
                transaction_type=TransactionType.EXPENSE.value,  # Use string value instead of enum
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_system=True,
                is_active=True
            )
            db.add(category)
        
        for cat_data in DEFAULT_INCOME_CATEGORIES:
            # Convert enum to string value to avoid type mismatch
            category = Category(
                user_id=target_user.id,
                name=cat_data["name"],
                transaction_type=TransactionType.INCOME.value,  # Use string value instead of enum
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_system=True,
                is_active=True
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


@router.patch("/users/{user_id}/premium", response_model=UserResponse)
async def update_user_premium(
    user_id: int,
    request: PremiumUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Update premium status for a user
    Only accessible by admins
    Sends notification to user when premium is activated
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
        # Get previous premium status
        previous_premium_status = getattr(target_user, 'is_premium', False) or False
        
        # Update premium status
        target_user.is_premium = request.is_premium
        db.commit()
        db.refresh(target_user)
        
        logger.info(f"Admin {current_admin.id} updated premium status for user {user_id}: {previous_premium_status} -> {request.is_premium}")
        
        # Send notification if premium was just activated (was False, now True)
        if not previous_premium_status and request.is_premium:
            from app.services.premium import send_premium_notification
            notification_sent = send_premium_notification(target_user)
            if notification_sent:
                logger.info(f"Premium activation notification sent to user {user_id}")
            else:
                logger.warning(f"Failed to send premium activation notification to user {user_id}")
        
        return UserResponse.model_validate(target_user)
        
    except Exception as e:
        logger.error(f"Error updating premium status: {str(e)}", exc_info=True)
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
    Sync admin status for current user based on ADMIN_TELEGRAM_IDS
    This endpoint can be called by any authenticated user to update their admin status
    """
    import logging
    from app.core.config import settings
    
    logger = logging.getLogger(__name__)
    
    if not current_user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for Telegram users"
        )
    
    should_be_admin = str(current_user.telegram_id) in settings.ADMIN_TELEGRAM_IDS
    
    logger.info(f"Syncing admin status for user {current_user.id}, telegram_id={current_user.telegram_id}, should_be_admin={should_be_admin}, current_is_admin={current_user.is_admin}")
    
    if current_user.is_admin != should_be_admin:
        current_user.is_admin = should_be_admin
        db.commit()
        db.refresh(current_user)
        logger.info(f"Updated admin status for user {current_user.id}: is_admin={should_be_admin}")
    
    return {
        "is_admin": current_user.is_admin,
        "telegram_id": current_user.telegram_id,
        "in_admin_list": should_be_admin,
        "admin_list": settings.ADMIN_TELEGRAM_IDS
    }
