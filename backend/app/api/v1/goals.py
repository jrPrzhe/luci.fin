from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.goal import Goal, GoalType, GoalStatus
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account, AccountType
from app.schemas.goal import (
    GoalCreate, GoalUpdate, GoalResponse, 
    GoalRoadmapRequest, GoalRoadmapResponse
)
from app.ai.assistant import AIAssistant
from app.models.notification import Notification, NotificationType, NotificationCategory
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[GoalResponse])
async def get_goals(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's goals"""
    query = db.query(Goal).filter(Goal.user_id == current_user.id)
    
    if status_filter:
        try:
            status_enum = GoalStatus(status_filter)
            query = query.filter(Goal.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
    
    goals = query.order_by(Goal.created_at.desc()).all()
    
    # Update progress for each goal and sync with account if linked
    for goal in goals:
        # If goal has linked account, sync with account balance
        if goal.account_id:
            from app.models.account import Account
            from app.models.transaction import Transaction, TransactionType
            account = db.query(Account).filter(Account.id == goal.account_id).first()
            if account:
                # Calculate account balance
                transactions = db.query(Transaction).filter(
                    Transaction.account_id == goal.account_id,
                    Transaction.user_id == current_user.id
                ).all()
                
                balance = Decimal(str(account.initial_balance))
                for trans in transactions:
                    if trans.transaction_type == TransactionType.INCOME:
                        balance += Decimal(str(trans.amount))
                    elif trans.transaction_type == TransactionType.EXPENSE:
                        balance -= Decimal(str(trans.amount))
                    elif trans.transaction_type == TransactionType.TRANSFER:
                        balance -= Decimal(str(trans.amount))
                
                # Update goal current_amount from account balance (ensure not negative)
                goal.current_amount = max(Decimal(0), balance)
        
        # Update progress percentage
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
                if current_user.telegram_id:
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
                                "chat_id": current_user.telegram_id,
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
    return goals


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific goal"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    # Update progress
    if goal.target_amount > 0:
        goal.progress_percentage = int((goal.current_amount / goal.target_amount) * 100)
    db.commit()
    
    return goal


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new goal and automatically create an account for it"""
    # Validate goal_type
    try:
        goal_type = GoalType(goal_data.goal_type)
    except ValueError:
        goal_type = GoalType.SAVE  # Default
    
    # Create account for the goal
    account = Account(
        user_id=current_user.id,
        name=f"Накопления: {goal_data.name}",
        account_type=AccountType.E_WALLET,  # Use E_WALLET for goal accounts
        currency=goal_data.currency,
        initial_balance=Decimal(0),
        description=f"Счет для цели: {goal_data.name}",
        is_active=True
    )
    
    db.add(account)
    db.flush()  # Flush to get account.id
    
    # Create goal linked to the account
    goal = Goal(
        user_id=current_user.id,
        goal_type=goal_type,
        name=goal_data.name,
        description=goal_data.description,
        target_amount=goal_data.target_amount,
        current_amount=Decimal(0),
        currency=goal_data.currency,
        start_date=datetime.utcnow(),
        target_date=goal_data.target_date,
        status=GoalStatus.ACTIVE,
        progress_percentage=0,
        roadmap=goal_data.roadmap,
        category_id=goal_data.category_id,
        account_id=account.id  # Link goal to account
    )
    
    db.add(goal)
    db.commit()
    db.refresh(goal)
    db.refresh(account)
    
    return goal


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    goal_update: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a goal"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    # Update fields
    if goal_update.name is not None:
        goal.name = goal_update.name
    if goal_update.description is not None:
        goal.description = goal_update.description
    if goal_update.target_amount is not None:
        goal.target_amount = goal_update.target_amount
    if goal_update.currency is not None:
        goal.currency = goal_update.currency
    if goal_update.target_date is not None:
        goal.target_date = goal_update.target_date
    if goal_update.current_amount is not None:
        goal.current_amount = goal_update.current_amount
    if goal_update.status is not None:
        try:
            goal.status = GoalStatus(goal_update.status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status"
            )
    if goal_update.roadmap is not None:
        goal.roadmap = goal_update.roadmap
    if goal_update.category_id is not None:
        goal.category_id = goal_update.category_id
    
    # Update progress
    if goal.target_amount > 0:
        goal.progress_percentage = int((goal.current_amount / goal.target_amount) * 100)
    
    # Check progress and send notifications
    await check_goal_progress(goal, db)
    
    db.commit()
    db.refresh(goal)
    
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a goal"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    db.delete(goal)
    db.commit()
    
    return None


@router.post("/{goal_id}/add-progress", response_model=GoalResponse)
async def add_progress_to_goal(
    goal_id: int,
    amount: Decimal,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add progress (money saved) to a goal"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
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
    
    goal.current_amount += amount
    
    # Update progress percentage
    if goal.target_amount > 0:
        goal.progress_percentage = int((goal.current_amount / goal.target_amount) * 100)
        
        # Check if goal is completed
        if goal.current_amount >= goal.target_amount:
            goal.status = GoalStatus.COMPLETED
            goal.progress_percentage = 100
            
            # Create success notification
            notification = Notification(
                user_id=goal.user_id,
                notification_type=NotificationType.SUCCESS,
                category=NotificationCategory.GOAL_UPDATE,
                title=f"🎉 Цель достигнута: {goal.name}",
                message=f"Поздравляем! Вы достигли своей финансовой цели '{goal.name}'. "
                       f"Накоплено {int(goal.current_amount):,} {goal.currency} из {int(goal.target_amount):,} {goal.currency}.",
                notification_metadata=json.dumps({"goal_id": goal.id, "type": "completed"})
            )
            db.add(notification)
        else:
            # Check progress and send notifications
            await check_goal_progress(goal, db)
    
    db.commit()
    db.refresh(goal)
    
    return goal


@router.post("/generate-roadmap", response_model=GoalRoadmapResponse)
async def generate_roadmap(
    request: GoalRoadmapRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI-powered roadmap for a goal"""
    assistant = AIAssistant()
    
    # Calculate expenses by category
    expenses_by_category = {}
    if request.transactions:
        for trans in request.transactions:
            if trans.get("transaction_type") == "expense":
                category_name = trans.get("category_name") or "Без категории"
                amount = float(trans.get("amount", 0))
                if category_name not in expenses_by_category:
                    expenses_by_category[category_name] = 0
                expenses_by_category[category_name] += amount
    
    # Calculate monthly averages
    monthly_income = Decimal(str(request.income_total / 12 if request.income_total > 0 else 0))
    monthly_expense = Decimal(str(request.expense_total / 12 if request.expense_total > 0 else 0))
    monthly_savings = monthly_income - monthly_expense
    
    # Calculate how much needs to be saved monthly
    target_amount = Decimal(str(request.target_amount))
    months_to_save = 12  # Default estimate
    if monthly_savings > 0:
        months_to_save = max(1, int(float(target_amount / monthly_savings)))
    
    monthly_savings_needed = target_amount / Decimal(str(months_to_save))
    
    # Determine feasibility
    feasibility = "feasible"
    if monthly_savings_needed > monthly_income * Decimal("0.3"):
        feasibility = "challenging"
    if monthly_savings_needed > monthly_income * Decimal("0.5"):
        feasibility = "difficult"
    
    # Generate roadmap using AI
    roadmap_text = ""
    recommendations = []
    savings_by_category = {}
    
    if assistant.client:
        try:
            # Build prompt for AI
            prompt = f"""Ты - финансовый консультант. Пользователь хочет достичь финансовой цели.

Цель: {request.goal_name}
Стоимость: {int(round(float(target_amount))):,} {request.currency}
Текущий баланс: {int(round(request.balance)):,} {request.currency}

Финансовое положение пользователя:
- Среднемесячный доход: {int(round(float(monthly_income))):,} {request.currency}
- Среднемесячные расходы: {int(round(float(monthly_expense))):,} {request.currency}
- Среднемесячные накопления: {int(round(float(monthly_savings))):,} {request.currency}

Топ категорий расходов:
"""
            for i, (cat, amount) in enumerate(sorted(expenses_by_category.items(), key=lambda x: x[1], reverse=True)[:5], 1):
                prompt += f"{i}. {cat}: {int(round(amount/12)):,} {request.currency}/мес\n"
            
            prompt += f"""

Создай детальную дорожную карту (roadmap) для достижения этой цели. Дорожная карта должна включать:
1. Пошаговый план на {months_to_save} месяцев
2. Рекомендации по экономии в конкретных категориях расходов
3. Конкретные суммы, которые можно сэкономить в каждой категории
4. Месячный план накоплений
5. Рекомендации по оптимизации расходов

Формат ответа должен быть структурированным и понятным. Используй эмодзи для визуализации.
Ответ должен быть на русском языке."""

            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                assistant.client.generate_content,
                prompt
            )
            
            roadmap_text = response.text if hasattr(response, 'text') else str(response)
            
            # Generate recommendations
            rec_prompt = f"""На основе анализа финансов пользователя, дай 3-5 конкретных рекомендаций по экономии для достижения цели "{request.goal_name}".
Ответ должен быть кратким списком рекомендаций на русском языке, каждая рекомендация в отдельной строке."""
            
            rec_response = await loop.run_in_executor(
                None,
                assistant.client.generate_content,
                rec_prompt
            )
            
            rec_text = rec_response.text if hasattr(rec_response, 'text') else str(rec_response)
            recommendations = [r.strip() for r in rec_text.split('\n') if r.strip() and not r.strip().startswith('*')][:5]
            
            # Calculate potential savings by category (suggest 10-20% reduction)
            for category, amount in expenses_by_category.items():
                monthly_cat_expense = Decimal(str(amount / 12))
                if monthly_cat_expense > 1000:  # Only for significant expenses
                    potential_savings = monthly_cat_expense * Decimal("0.15")  # 15% savings
                    savings_by_category[category] = potential_savings
            
        except Exception as e:
            logger.error(f"AI roadmap generation error: {e}")
            roadmap_text = generate_fallback_roadmap(request, monthly_savings_needed, months_to_save)
    else:
        roadmap_text = generate_fallback_roadmap(request, monthly_savings_needed, months_to_save)
        recommendations.append("Сократите расходы на 15-20% в категориях с наибольшими тратами")
        recommendations.append("Создайте отдельный счет для накоплений")
        recommendations.append("Отслеживайте прогресс ежемесячно")
    
    # Create roadmap JSON structure
    roadmap_data = {
        "goal_name": request.goal_name,
        "target_amount": float(target_amount),
        "currency": request.currency,
        "monthly_savings_needed": float(monthly_savings_needed),
        "estimated_months": months_to_save,
        "feasibility": feasibility,
        "roadmap_text": roadmap_text,
        "recommendations": recommendations,
        "savings_by_category": {k: float(v) for k, v in savings_by_category.items()},
        "monthly_plan": []
    }
    
    # Generate monthly plan
    for month in range(1, min(months_to_save + 1, 13)):  # Max 12 months
        roadmap_data["monthly_plan"].append({
            "month": month,
            "target_savings": float(monthly_savings_needed),
            "cumulative_target": float(monthly_savings_needed * month)
        })
    
    return GoalRoadmapResponse(
        roadmap=json.dumps(roadmap_data, ensure_ascii=False),
        monthly_savings_needed=monthly_savings_needed,
        feasibility=feasibility,
        recommendations=recommendations,
        savings_by_category=savings_by_category,
        estimated_months=months_to_save
    )


def generate_fallback_roadmap(request: GoalRoadmapRequest, monthly_savings: Decimal, months: int) -> str:
    """Generate fallback roadmap without AI"""
    roadmap = f"""🗺️ Дорожная карта для достижения цели: {request.goal_name}

💰 Цель: {int(round(float(request.target_amount))):,} {request.currency}
📅 Оценка времени: {months} месяцев
💵 Ежемесячные накопления: {int(round(float(monthly_savings))):,} {request.currency}

📋 План действий:
1. Создайте отдельный счет для накоплений
2. Откладывайте {int(round(float(monthly_savings))):,} {request.currency} каждый месяц
3. Пересматривайте прогресс ежемесячно
4. Оптимизируйте расходы в категориях с наибольшими тратами

💡 Рекомендации:
• Отслеживайте все расходы
• Сократите необязательные траты на 15-20%
• Ищите дополнительные источники дохода при необходимости"""
    
    return roadmap


async def check_goal_progress(goal: Goal, db: Session) -> None:
    """Check goal progress and send notifications if needed"""
    if goal.status != GoalStatus.ACTIVE:
        return
    
    # Calculate expected progress based on time
    if goal.target_date and goal.start_date:
        total_days = (goal.target_date - goal.start_date).days
        elapsed_days = (datetime.utcnow() - goal.start_date).days
        
        if total_days > 0 and elapsed_days > 0:
            expected_progress = (elapsed_days / total_days) * 100
            actual_progress = goal.progress_percentage
            
            # Check if behind schedule
            if actual_progress < expected_progress - 10:  # 10% threshold
                days_behind = int((expected_progress - actual_progress) / 100 * total_days)
                amount_needed = goal.target_amount - goal.current_amount
                
                # Check if notification was already sent recently (within last 7 days)
                recent_notification = db.query(Notification).filter(
                    Notification.user_id == goal.user_id,
                    Notification.category == NotificationCategory.GOAL_UPDATE,
                    Notification.notification_metadata.contains(f'"goal_id":{goal.id}'),
                    Notification.created_at >= datetime.utcnow() - timedelta(days=7)
                ).first()
                
                if not recent_notification:
                    # Create notification
                    notification = Notification(
                        user_id=goal.user_id,
                        notification_type=NotificationType.WARNING,
                        category=NotificationCategory.GOAL_UPDATE,
                        title=f"⚠️ Отставание от плана: {goal.name}",
                        message=f"Вы отстаете от плана на {days_behind} дней. "
                               f"Для достижения цели необходимо накопить еще {int(amount_needed):,} {goal.currency}. "
                               f"Рекомендуется пересмотреть план накоплений.",
                        notification_metadata=json.dumps({"goal_id": goal.id, "type": "behind_schedule"})
                    )
                    db.add(notification)
                    db.commit()


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a goal and optionally archive its associated account"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    # If goal has an associated account, handle it
    account_id = goal.account_id
    if account_id:
        account = db.query(Account).filter(Account.id == account_id).first()
        if account:
            # Check if account has transactions
            transaction_count = db.query(Transaction).filter(
                Transaction.account_id == account_id
            ).count()
            
            if transaction_count > 0:
                # Archive account if it has transactions
                account.is_archived = True
                account.is_active = False
            else:
                # Delete account if no transactions
                db.delete(account)
    
    # Delete all transactions linked to this goal
    db.query(Transaction).filter(Transaction.goal_id == goal_id).update({Transaction.goal_id: None})
    
    # Delete the goal
    db.delete(goal)
    db.commit()
    
    return None


@router.post("/{goal_id}/check-progress")
async def check_goal_progress_endpoint(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually check goal progress and send notifications"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    await check_goal_progress(goal, db)
    
    return {"message": "Goal progress checked", "status": goal.status, "progress": goal.progress_percentage}

