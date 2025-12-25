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

# Log router creation for debugging
logger.info("Goals router created and ready to register routes")


@router.get("", response_model=List[GoalResponse], include_in_schema=True)
async def get_goals(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's goals"""
    logger.info(f"[GET_GOALS] Endpoint called for user_id={current_user.id}, status_filter={status_filter}")
    logger.info(f"[GET_GOALS] Router registered at /api/v1/goals")
    try:
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
                    
                    # Update goal current_amount from account balance (ensure not negative and not exceeding target)
                    goal.current_amount = max(Decimal(0), min(balance, goal.target_amount))
            
            # Update progress percentage
            if goal.target_amount > 0:
                # Calculate progress percentage (ensure it's between 0 and 100)
                progress = int((goal.current_amount / goal.target_amount) * 100)
                goal.progress_percentage = max(0, min(100, progress))
                
                # Check if goal is completed
                # Compare with enum value, not string
                current_status = goal.status if isinstance(goal.status, GoalStatus) else GoalStatus(goal.status) if isinstance(goal.status, str) else goal.status
                was_active = current_status == GoalStatus.ACTIVE
                # Only mark as completed if it was active and reached target exactly
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
        
        # Commit changes if any were made
        try:
            db.commit()
        except Exception as commit_error:
            logger.error(f"Error committing goals changes: {commit_error}", exc_info=True)
            db.rollback()
            # Don't fail the request if commit fails, just log it
        
        # Convert goals to response format with enum fields as strings
        # This ensures Pydantic validation works correctly
        goals_response = []
        for goal in goals:
            goal_dict = {
                'id': goal.id,
                'user_id': goal.user_id,
                'goal_type': goal.goal_type.value if isinstance(goal.goal_type, GoalType) else (goal.goal_type.value if hasattr(goal.goal_type, 'value') else str(goal.goal_type)),
                'name': goal.name,
                'description': goal.description,
                'target_amount': goal.target_amount,
                'current_amount': goal.current_amount,
                'currency': goal.currency,
                'status': goal.status.value if isinstance(goal.status, GoalStatus) else (goal.status.value if hasattr(goal.status, 'value') else str(goal.status)),
                'progress_percentage': goal.progress_percentage,
                'roadmap': goal.roadmap,
                'start_date': goal.start_date,
                'target_date': goal.target_date,
                'category_id': goal.category_id,
                'created_at': goal.created_at,
                'updated_at': goal.updated_at,
            }
            goals_response.append(GoalResponse(**goal_dict))
        
        return goals_response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting goals for user {current_user.id}: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении целей: {str(e)}"
        )


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
            detail="Цель не найдена"
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
    
    # Handle roadmap - ensure it's a JSON string
    roadmap_value = goal_data.roadmap
    if roadmap_value:
        # If roadmap is already a JSON string (from generate-roadmap endpoint), use it as is
        # If it's a dict/object (shouldn't happen but handle it), convert to JSON string
        if isinstance(roadmap_value, dict):
            roadmap_value = json.dumps(roadmap_value, ensure_ascii=False)
        elif isinstance(roadmap_value, str):
            # If it's a string, it might be double-encoded, try to parse and re-encode
            try:
                # Try to parse it - if it's valid JSON, it's already a JSON string
                parsed = json.loads(roadmap_value)
                # Re-encode to ensure it's properly formatted
                roadmap_value = json.dumps(parsed, ensure_ascii=False)
                logger.info(f"Roadmap parsed and re-encoded for goal: {goal_data.name}")
            except (json.JSONDecodeError, TypeError):
                # If parsing fails, it's already a plain string, use as is
                logger.info(f"Roadmap is plain string for goal: {goal_data.name}")
        logger.info(f"Roadmap will be saved for goal: {goal_data.name}, length: {len(roadmap_value) if roadmap_value else 0}")
    else:
        logger.info(f"No roadmap provided for goal: {goal_data.name}")
    
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
        roadmap=roadmap_value,
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
            detail="Цель не найдена"
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
        # Ensure current_amount doesn't exceed target_amount
        goal.current_amount = min(goal_update.current_amount, goal.target_amount)
    if goal_update.status is not None:
        try:
            goal.status = GoalStatus(goal_update.status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный статус"
            )
    if goal_update.roadmap is not None:
        # Handle roadmap - ensure it's a JSON string
        roadmap_value = goal_update.roadmap
        if isinstance(roadmap_value, dict):
            roadmap_value = json.dumps(roadmap_value, ensure_ascii=False)
        elif isinstance(roadmap_value, str):
            # If it's a string, it might be double-encoded, try to parse and re-encode
            try:
                # Try to parse it - if it's valid JSON, it's already a JSON string
                parsed = json.loads(roadmap_value)
                # Re-encode to ensure it's properly formatted
                roadmap_value = json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, TypeError):
                # If parsing fails, it's already a plain string, use as is
                pass
        goal.roadmap = roadmap_value
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
            detail="Цель не найдена"
        )
    
    if goal.status != GoalStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Можно добавлять прогресс только к активным целям"
        )
    
    # Check if amount doesn't exceed remaining amount to reach goal
    remaining_amount = goal.target_amount - goal.current_amount
    if amount > remaining_amount:
        remaining_formatted = f"{float(remaining_amount):,.2f}".replace(',', ' ')
        amount_formatted = f"{float(amount):,.2f}".replace(',', ' ')
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Нельзя перевести больше, чем осталось до цели. Осталось до цели: {remaining_formatted} {goal.currency}, вы пытаетесь перевести: {amount_formatted} {goal.currency}"
        )
    
    goal.current_amount += amount
    # Ensure current_amount doesn't exceed target_amount
    goal.current_amount = min(goal.current_amount, goal.target_amount)
    
    # Update progress percentage
    if goal.target_amount > 0:
        goal.progress_percentage = int((goal.current_amount / goal.target_amount) * 100)
        # Ensure progress doesn't exceed 100%
        goal.progress_percentage = min(100, goal.progress_percentage)
        
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
    
    # Calculate current savings progress
    current_savings = Decimal(str(request.balance))
    remaining_amount = target_amount - current_savings
    
    # Calculate top expense categories for recommendations
    top_categories = sorted(expenses_by_category.items(), key=lambda x: x[1], reverse=True)[:5]
    
    if assistant.client:
        try:
            # Extract values to avoid scope issues in f-strings
            goal_name = request.goal_name
            currency = request.currency
            balance = request.balance
            
            # Build structured prompt for AI
            prompt = f"""Ты - финансовый консультант. Создай структурированную дорожную карту для достижения финансовой цели.

Цель: {goal_name}
Стоимость цели: {int(round(float(target_amount))):,} {currency}
Текущий баланс: {int(round(balance)):,} {currency}
Осталось накопить: {int(round(float(remaining_amount))):,} {currency}

Финансовое положение пользователя:
- Среднемесячный доход: {int(round(float(monthly_income))):,} {currency}
- Среднемесячные расходы: {int(round(float(monthly_expense))):,} {currency}
- Среднемесячные накопления: {int(round(float(monthly_savings))):,} {currency}

Топ категорий расходов:
"""
            for i, (cat, amount) in enumerate(top_categories, 1):
                monthly_cat = int(round(amount/12))
                prompt += f"{i}. {cat}: {monthly_cat:,} {currency}/мес\n"
            
            monthly_savings_needed_int = int(round(float(monthly_savings_needed)))
            prompt += f"""

Создай дорожную карту в СТРОГО следующем формате (три раздела):

РАЗДЕЛ 1 - ОБЗОР ТЕКУЩЕГО ПОЛОЖЕНИЯ:
Начни с анализа текущих транзакций и накоплений пользователя. Опиши:
- Текущее состояние накоплений для этой цели
- Анализ основных категорий расходов
- Текущий уровень доходов и расходов
- Что уже сделано для достижения цели

РАЗДЕЛ 2 - ЧТО НУЖНО ДЕЛАТЬ:
Четко опиши конкретный план действий:
- Сколько нужно откладывать каждый месяц: {monthly_savings_needed_int:,} {currency}
- Сколько месяцев потребуется: {months_to_save}
- Конкретные шаги для достижения цели с учетом доходов и расходов
- Как распределить накопления по месяцам

РАЗДЕЛ 3 - РЕКОМЕНДАЦИИ:
Дай конкретные рекомендации по оптимизации расходов:
- Для каждой топ-категории расходов укажи, сколько можно сэкономить
- Рассчитай, на сколько месяцев быстрее можно достичь цели при следовании рекомендациям
- Пример: "Вы тратите много на [категория]. Если сократите расходы на [сумма]/мес, то достигнете цели на [X] месяцев быстрее"

Используй эмодзи для визуализации. Ответ должен быть на русском языке и структурированным."""

            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                assistant.client.generate_content,
                prompt
            )
            
            roadmap_text = response.text if hasattr(response, 'text') else str(response)
            
            # Generate detailed recommendations with time savings
            target_amount_int = int(round(float(target_amount)))
            rec_prompt = f"""На основе анализа финансов пользователя, создай 3-5 конкретных рекомендаций по экономии для достижения цели "{goal_name}".

Для каждой рекомендации:
1. Укажи категорию расходов
2. Укажи сумму, которую можно сэкономить в месяц
3. Рассчитай, на сколько месяцев быстрее можно достичь цели

Текущая ситуация:
- Цель: {target_amount_int:,} {currency}
- Нужно откладывать в месяц: {monthly_savings_needed_int:,} {currency}
- Оценка времени: {months_to_save} месяцев

Топ категории расходов:
"""
            for cat, amount in top_categories:
                monthly_cat = int(round(amount/12))
                rec_prompt += f"- {cat}: {monthly_cat:,} {currency}/мес\n"
            
            rec_prompt += "\nОтвет должен быть кратким списком рекомендаций на русском языке, каждая рекомендация в отдельной строке с расчетом экономии времени."
            
            rec_response = await loop.run_in_executor(
                None,
                assistant.client.generate_content,
                rec_prompt
            )
            
            rec_text = rec_response.text if hasattr(rec_response, 'text') else str(rec_response)
            recommendations = [r.strip() for r in rec_text.split('\n') if r.strip() and not r.strip().startswith('*') and len(r.strip()) > 10][:5]
            
            # Calculate potential savings by category and time savings
            for category, amount in expenses_by_category.items():
                monthly_cat_expense = Decimal(str(amount / 12))
                if monthly_cat_expense > 1000:  # Only for significant expenses
                    potential_savings = monthly_cat_expense * Decimal("0.15")  # 15% savings
                    savings_by_category[category] = potential_savings
                    
                    # Calculate time savings if this category is reduced
                    if monthly_savings_needed > 0:
                        new_monthly_savings = monthly_savings + potential_savings
                        if new_monthly_savings > 0:
                            new_months = max(1, int(float(remaining_amount / new_monthly_savings)))
                            time_saved = months_to_save - new_months
                            if time_saved > 0:
                                savings_by_category[f"{category}_time_saved"] = time_saved
            
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
    target_amount = Decimal(str(request.target_amount))
    current_balance = Decimal(str(request.balance))
    remaining = target_amount - current_balance
    
    # Calculate monthly averages for context
    monthly_income = Decimal(str(request.income_total / 12 if request.income_total > 0 else 0))
    monthly_expense = Decimal(str(request.expense_total / 12 if request.expense_total > 0 else 0))
    
    roadmap = f"""📊 ОБЗОР ТЕКУЩЕГО ПОЛОЖЕНИЯ:

Ваша финансовая ситуация:
• Текущий баланс: {int(round(float(current_balance))):,} {request.currency}
• Цель: {int(round(float(target_amount))):,} {request.currency}
• Осталось накопить: {int(round(float(remaining))):,} {request.currency}

Анализ доходов и расходов:
• Среднемесячный доход: {int(round(float(monthly_income))):,} {request.currency}
• Среднемесячные расходы: {int(round(float(monthly_expense))):,} {request.currency}
• Текущие накопления в месяц: {int(round(float(monthly_savings))):,} {request.currency}

🎯 ЧТО НУЖНО ДЕЛАТЬ:

Для достижения цели "{request.goal_name}" вам необходимо:

1. Ежемесячно откладывать: {int(round(float(monthly_savings))):,} {request.currency}
2. Срок достижения цели: {months} месяцев
3. План по месяцам:
"""
    
    # Add monthly breakdown
    for month in range(1, min(months + 1, 7)):  # Show first 6 months
        cumulative = monthly_savings * month
        roadmap += f"   Месяц {month}: накоплено {int(round(float(cumulative))):,} {request.currency}\n"
    
    if months > 6:
        roadmap += f"   ... и так далее до {months} месяца\n"
    
    roadmap += f"""
💡 РЕКОМЕНДАЦИИ:

Для ускорения достижения цели:
• Сократите расходы на 15-20% в категориях с наибольшими тратами
• Создайте отдельный счет для накоплений и автоматизируйте переводы
• Отслеживайте прогресс ежемесячно и корректируйте план при необходимости
• Ищите дополнительные источники дохода для ускорения накоплений"""
    
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
    """Delete a goal and its associated account with all related transactions"""
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Цель не найдена"
        )
    
    # If goal has an associated account, delete it and all related transactions
    account_id = goal.account_id
    if account_id:
        account = db.query(Account).filter(Account.id == account_id).first()
        if account:
            # Get all transaction IDs that need to be deleted
            # Transactions where account is source
            source_transaction_ids = db.query(Transaction.id).filter(
                Transaction.account_id == account_id
            ).all()
            source_transaction_ids = [t[0] for t in source_transaction_ids]
            
            # Transactions where account is destination (transfers)
            dest_transaction_ids = db.query(Transaction.id).filter(
                Transaction.to_account_id == account_id
            ).all()
            dest_transaction_ids = [t[0] for t in dest_transaction_ids]
            
            all_transaction_ids = list(set(source_transaction_ids + dest_transaction_ids))
            
            if all_transaction_ids:
                # Delete transaction_tags first (foreign key constraint)
                from sqlalchemy import delete
                from app.models.transaction import transaction_tags
                
                # Delete all transaction_tags for these transactions
                delete_tags_stmt = delete(transaction_tags).where(
                    transaction_tags.c.transaction_id.in_(all_transaction_ids)
                )
                db.execute(delete_tags_stmt)
                
                # Delete all transactions in bulk
                db.query(Transaction).filter(Transaction.id.in_(all_transaction_ids)).delete(synchronize_session=False)
            
            # Delete the account
            db.delete(account)
    
    # Delete all transactions linked to this goal (unlink goal_id)
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
            detail="Цель не найдена"
        )
    
    await check_goal_progress(goal, db)
    
    return {"message": "Goal progress checked", "status": goal.status, "progress": goal.progress_percentage}

