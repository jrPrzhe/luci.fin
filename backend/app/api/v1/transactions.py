from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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
    
    # Base query: user's own transactions
    from sqlalchemy import or_
    
    if account_id:
        # Get transactions for specific account
        account = db.query(Account).filter(Account.id == account_id).first()
        if account and account.shared_budget_id:
            # Shared account: get all transactions (from all members)
            from app.models.shared_budget import SharedBudgetMember
            membership = db.query(SharedBudgetMember).filter(
                SharedBudgetMember.shared_budget_id == account.shared_budget_id,
                SharedBudgetMember.user_id == current_user.id
            ).first()
            if membership:
                # User has access, get all transactions for this account
                query = db.query(Transaction).filter(Transaction.account_id == account_id)
            else:
                query = db.query(Transaction).filter(
                    Transaction.account_id == account_id,
                    Transaction.user_id == current_user.id
                )
        else:
            # Personal account: only user's transactions
            query = db.query(Transaction).filter(
                Transaction.account_id == account_id,
                Transaction.user_id == current_user.id
            )
    else:
        # Get user's transactions + transactions from shared accounts user has access to
        from app.models.shared_budget import SharedBudgetMember
        budget_memberships = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.user_id == current_user.id
        ).all()
        budget_ids = [m.shared_budget_id for m in budget_memberships]
        shared_account_ids = []
        
        if budget_ids:
            shared_accounts = db.query(Account).filter(
                Account.shared_budget_id.in_(budget_ids)
            ).all()
            shared_account_ids = [a.id for a in shared_accounts]
        
        # Apply filter before building query
        if filter_type == "own":
            # Only user's own transactions
            query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
        elif filter_type == "shared":
            # Only shared account transactions (all transactions from shared accounts)
            if shared_account_ids:
                query = db.query(Transaction).filter(Transaction.account_id.in_(shared_account_ids))
            else:
                # No shared accounts, return empty
                query = db.query(Transaction).filter(Transaction.id == -1)  # Impossible condition
        else:
            # All transactions: user's + shared account transactions
            if shared_account_ids:
                query = db.query(Transaction).filter(
                    or_(
                        Transaction.user_id == current_user.id,
                        Transaction.account_id.in_(shared_account_ids)
                    )
                )
            else:
                query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    # Apply transaction type filter
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    # Apply date filters
    if start_date:
        try:
            from datetime import datetime
            # Handle different date formats
            if 'T' in start_date:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            else:
                start_dt = datetime.fromisoformat(start_date + 'T00:00:00')
            query = query.filter(Transaction.transaction_date >= start_dt)
            logger.info(f"Applied start_date filter: {start_dt}")
        except (ValueError, AttributeError) as e:
            logger.warning(f"Invalid start_date format: {start_date}, error: {e}")
    
    if end_date:
        try:
            from datetime import datetime
            # Handle different date formats
            if 'T' in end_date:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            else:
                end_dt = datetime.fromisoformat(end_date + 'T23:59:59')
            query = query.filter(Transaction.transaction_date <= end_dt)
            logger.info(f"Applied end_date filter: {end_dt}")
        except (ValueError, AttributeError) as e:
            logger.warning(f"Invalid end_date format: {end_date}, error: {e}")
    
    # Используем joinedload для предзагрузки связей (исправление N+1 проблемы)
    from sqlalchemy.orm import joinedload
    transactions = query.options(
        joinedload(Transaction.account),
        joinedload(Transaction.category),
        joinedload(Transaction.goal)
    ).order_by(Transaction.transaction_date.desc()).limit(limit).offset(offset).all()
    
    logger.info(f"Found {len(transactions)} transactions for user {current_user.id}, filter={filter_type}")
    
    # Build response with additional info
    result = []
    for t in transactions:
        trans_dict = TransactionResponse.model_validate(t).model_dump()
        # Check if transaction is from shared account (используем предзагруженный account)
        is_shared = t.account.shared_budget_id is not None if t.account else False
        trans_dict['user_id'] = t.user_id
        trans_dict['is_shared'] = is_shared
        
        # Add category info if exists (используем предзагруженную category)
        if t.category:
            trans_dict['category_name'] = t.category.name
            trans_dict['category_icon'] = t.category.icon
        
        # Add goal info if exists (используем предзагруженный goal)
        if t.goal:
            trans_dict['goal_name'] = t.goal.name
        
        result.append(TransactionResponse(**trans_dict))
    
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
    
    balance = Decimal(str(account.initial_balance))
    for trans in transactions:
        if trans.transaction_type == TransactionType.INCOME:
            balance += Decimal(str(trans.amount))
        elif trans.transaction_type == TransactionType.EXPENSE:
            balance -= Decimal(str(trans.amount))
        elif trans.transaction_type == TransactionType.TRANSFER:
            # For transfer, decrease from source account
            balance -= Decimal(str(trans.amount))
    
    # Update goal current_amount and progress
    # Ensure current_amount is not negative
    goal.current_amount = max(Decimal(0), balance)
    if goal.target_amount > 0:
        # Calculate progress percentage (ensure it's between 0 and 100)
        progress = int((goal.current_amount / goal.target_amount) * 100)
        goal.progress_percentage = max(0, min(100, progress))
        
        # Check if goal is completed
        was_active = goal.status == GoalStatus.ACTIVE
        if goal.current_amount >= goal.target_amount and was_active:
            goal.status = GoalStatus.COMPLETED
            goal.progress_percentage = 100
            
            # Send Telegram notification if user has telegram_id
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
    
    db.commit()


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new transaction"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Creating transaction for user_id={current_user.id}, account_id={transaction_data.account_id}, type={transaction_data.transaction_type}")
    
    # Verify account belongs to user or user has access through shared budget
    account = db.query(Account).filter(Account.id == transaction_data.account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
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
            detail="You don't have access to this account"
        )
    
    # Validate transaction type
    if transaction_data.transaction_type not in ["income", "expense", "transfer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction type must be 'income', 'expense', or 'transfer'"
        )
    
    # For transfer, verify to_account_id
    to_account = None
    if transaction_data.transaction_type == "transfer":
        if not transaction_data.to_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="to_account_id is required for transfer transactions"
            )
        
        to_account = db.query(Account).filter(Account.id == transaction_data.to_account_id).first()
        
        if not to_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Destination account not found"
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
                detail="You don't have access to destination account"
            )
        
        if transaction_data.account_id == transaction_data.to_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and destination accounts must be different"
            )
        
        # Create transaction for destination account (income)
        to_transaction = Transaction(
            user_id=current_user.id,
            account_id=transaction_data.to_account_id,
            transaction_type=TransactionType.INCOME,
            amount=transaction_data.amount,
            currency=transaction_data.currency or account.currency,
            description=f"Перевод из {account.name}" + (f": {transaction_data.description}" if transaction_data.description else ""),
            transaction_date=transaction_data.transaction_date or datetime.utcnow()
        )
        db.add(to_transaction)
    
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
                detail="Shared budget not found"
            )
        
        # Check if user is a member of the shared budget
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == transaction_data.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this shared budget"
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
                detail="Goal not found"
            )
        
        if goal.status != GoalStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only add progress to active goals"
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
            detail="Account not found"
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
            detail="You don't have access to this account"
        )
    
    transaction = Transaction(
        user_id=current_user.id,
        account_id=final_account_id,  # Use goal's account if goal is specified
        transaction_type=TransactionType(transaction_data.transaction_type),
        amount=transaction_data.amount,
        currency=transaction_data.currency or final_account.currency,
        category_id=transaction_data.category_id,
        description=transaction_data.description,
        transaction_date=transaction_data.transaction_date or datetime.utcnow(),
        to_account_id=transaction_data.to_account_id if transaction_data.transaction_type == "transfer" else None,
        shared_budget_id=transaction_data.shared_budget_id,
        goal_id=transaction_data.goal_id
    )
    
    db.add(transaction)
    
    # Для transfer также нужно обновить баланс получателя
    if transaction_data.transaction_type == "transfer" and to_transaction:
        try:
            db.commit()  # Коммитим обе транзакции вместе
            db.refresh(transaction)
            db.refresh(to_transaction)
            logger.info(f"Transfer created: source transaction {transaction.id}, destination transaction {to_transaction.id}")
        except Exception as e:
            logger.error(f"Error creating transfer transactions: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create transfer: {str(e)}"
            )
    else:
        db.commit()
        db.refresh(transaction)
    
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
            transaction_date = transaction.transaction_date or datetime.utcnow()
            
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
            from datetime import timezone
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
    
    response = TransactionResponse.model_validate(transaction)
    # Добавляем информацию о геймификации в ответ (через dict для совместимости)
    response_dict = response.model_dump()
    response_dict["gamification"] = gamification_info
    
    return response_dict


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a transaction"""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
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
        account = db.query(Account).filter(
            Account.id == transaction_data.account_id,
            Account.user_id == current_user.id
        ).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found"
            )
        transaction.account_id = transaction_data.account_id
    
    if transaction_data.transaction_type is not None:
        if transaction_data.transaction_type not in ["income", "expense", "transfer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction type must be 'income', 'expense', or 'transfer'"
            )
        transaction.transaction_type = TransactionType(transaction_data.transaction_type)
    
    if transaction_data.amount is not None:
        transaction.amount = transaction_data.amount
    
    if transaction_data.goal_id is not None:
        # Handle goal changes
        if transaction_data.goal_id == 0:
            # Remove goal
            transaction.goal_id = None
        else:
            # Add/change goal
            goal = db.query(Goal).filter(
                Goal.id == transaction_data.goal_id,
                Goal.user_id == current_user.id
            ).first()
            if goal and goal.status == GoalStatus.ACTIVE:
                transaction.goal_id = transaction_data.goal_id
    
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
    
    db.commit()
    db.refresh(transaction)
    
    # Sync goals with account balances if transaction affects goal accounts
    account_ids_to_sync = set()
    
    # Old account (if changed)
    if old_account_id:
        goal = db.query(Goal).filter(Goal.account_id == old_account_id).first()
        if goal and goal.user_id == current_user.id:
            account_ids_to_sync.add(old_account_id)
    
    # New account (current)
    if transaction.account_id:
        goal = db.query(Goal).filter(Goal.account_id == transaction.account_id).first()
        if goal and goal.user_id == current_user.id:
            account_ids_to_sync.add(transaction.account_id)
    
    # Sync all affected goal accounts
    for account_id in account_ids_to_sync:
        _sync_goal_with_account(account_id, current_user.id, db)
    
    return TransactionResponse.model_validate(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a transaction"""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    # Store account IDs that might need goal syncing
    account_ids_to_sync = set()
    if transaction.account_id:
        goal = db.query(Goal).filter(Goal.account_id == transaction.account_id).first()
        if goal and goal.user_id == current_user.id:
            account_ids_to_sync.add(transaction.account_id)
    
    # If it's a transfer, also delete the corresponding income transaction
    if transaction.transaction_type == TransactionType.TRANSFER and transaction.to_account_id:
        to_transaction = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.account_id == transaction.to_account_id,
            Transaction.transaction_type == TransactionType.INCOME,
            Transaction.amount == transaction.amount,
            Transaction.transaction_date == transaction.transaction_date
        ).first()
        if to_transaction:
            # Check if destination account is a goal account
            goal = db.query(Goal).filter(Goal.account_id == transaction.to_account_id).first()
            if goal and goal.user_id == current_user.id:
                account_ids_to_sync.add(transaction.to_account_id)
            db.delete(to_transaction)
    
    db.delete(transaction)
    db.commit()
    
    # Sync goals with account balances
    for account_id in account_ids_to_sync:
        _sync_goal_with_account(account_id, current_user.id, db)
    
    return None

