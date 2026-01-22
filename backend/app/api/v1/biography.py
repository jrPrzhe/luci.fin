from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal
import json
import logging

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.biography import Biography, QuestionnaireResponse as QuestionnaireResponseModel, BiographyCategoryLimit
from app.models.category import Category
from app.models.transaction import Transaction, TransactionType
from app.models.goal import Goal, GoalType, GoalStatus
from app.schemas.biography import (
    QuestionnaireRequest,
    BiographyResponse,
    BiographyCategoryLimitResponse,
    NewUserStatusResponse,
    MarkUserNotNewRequest,
    CreateGoalFromBiographyRequest,
    UpdateIncomeRequest,
    UpdateCategoryLimitsRequest
)
from app.ai.assistant import AIAssistant
from app.api.v1.gamification import get_or_create_profile

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/new-user-status", response_model=NewUserStatusResponse)
async def get_new_user_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус new_user для пользователя"""
    # Проверяем есть ли биография
    biography = db.query(Biography).filter(
        Biography.user_id == current_user.id,
        Biography.is_current == True
    ).first()
    
    has_biography = biography is not None
    
    return NewUserStatusResponse(
        new_user=current_user.new_user,
        has_biography=has_biography
    )


@router.post("/mark-not-new", response_model=dict)
async def mark_user_not_new(
    request: MarkUserNotNewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Пометить пользователя как не нового (закрыл визард)"""
    current_user.new_user = False
    db.commit()
    db.refresh(current_user)
    
    return {"success": True, "new_user": False}


@router.post("/questionnaire", response_model=BiographyResponse, status_code=status.HTTP_201_CREATED)
async def submit_questionnaire(
    questionnaire: QuestionnaireRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отправить анкетирование и создать биографию с ИИ-анализом"""
    try:
        # Проверяем есть ли уже текущая биография
        existing_biography = db.query(Biography).filter(
            Biography.user_id == current_user.id,
            Biography.is_current == True
        ).first()
        
        # Если есть, помечаем как не текущую
        if existing_biography:
            existing_biography.is_current = False
            existing_biography.period_end = datetime.utcnow()
        
        # Создаем новую биографию
        biography = Biography(
            user_id=current_user.id,
            monthly_income=questionnaire.monthly_income,
            period_start=datetime.utcnow(),
            is_current=True
        )
        db.add(biography)
        db.flush()
        
        # Сохраняем ответы на анкетирование
        # Конвертируем Decimal в float для JSON
        category_limits_dict = {k: float(v) for k, v in questionnaire.category_limits.items()}
        questionnaire_response = QuestionnaireResponseModel(
            biography_id=biography.id,
            category_limits=category_limits_dict,
            monthly_income=questionnaire.monthly_income,
            problems_text=questionnaire.problems_text,
            problems_options=questionnaire.problems_options if questionnaire.problems_options else None,
            goal_text=questionnaire.goal_text,
            goal_options=questionnaire.goal_options if questionnaire.goal_options else None
        )
        db.add(questionnaire_response)
        db.flush()
        
        # Создаем лимиты категорий
        category_limits = []
        for category_name, limit in questionnaire.category_limits.items():
            # Ищем существующую категорию или создаем новую
            category = db.query(Category).filter(
                Category.user_id == current_user.id,
                Category.name == category_name
            ).first()
            
            category_limit = BiographyCategoryLimit(
                biography_id=biography.id,
                category_name=category_name,
                category_id=category.id if category else None,
                user_limit=limit,
                currency=current_user.default_currency
            )
            db.add(category_limit)
            category_limits.append(category_limit)
        
        db.flush()
        
        # Анализируем анкету через ИИ для генерации плановых лимитов
        try:
            ai_analysis = await analyze_questionnaire_with_ai(
                questionnaire=questionnaire,
                currency=current_user.default_currency,
                db=db,
                current_user=current_user,
                force_recalculate=False
            )
            
            # Обновляем биографию с результатами ИИ
            if ai_analysis.get("problems_summary"):
                biography.problems = ai_analysis["problems_summary"]
            if ai_analysis.get("goal_summary"):
                biography.goal = ai_analysis["goal_summary"]
            
            # Обновляем плановые лимиты от ИИ
            if ai_analysis.get("recommended_limits"):
                for category_limit in category_limits:
                    category_name = category_limit.category_name
                    if category_name in ai_analysis["recommended_limits"]:
                        category_limit.ai_recommended_limit = Decimal(str(ai_analysis["recommended_limits"][category_name]))
        except Exception as e:
            logger.error(f"Error analyzing questionnaire with AI: {e}")
            # Продолжаем без ИИ-анализа, если произошла ошибка
        
        # Создаем цели из биографии
        await create_goals_from_biography(
            biography=biography,
            questionnaire=questionnaire,
            current_user=current_user,
            db=db
        )
        
        # Помечаем пользователя как не нового
        current_user.new_user = False
        
        db.commit()
        db.refresh(biography)
        
        # Загружаем связанные данные
        db.refresh(biography)
        for limit in category_limits:
            db.refresh(limit)
        
        return biography
        
    except Exception as e:
        logger.error(f"Error submitting questionnaire: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при сохранении анкеты: {str(e)}"
        )


async def analyze_questionnaire_with_ai(
    questionnaire: QuestionnaireRequest,
    currency: str,
    db: Session,
    current_user: User,
    force_recalculate: bool = False
) -> dict:
    """Анализировать анкету через ИИ для генерации плановых лимитов"""
    assistant = AIAssistant()
    
    if not assistant.client:
        logger.warning("AI client not available, skipping AI analysis")
        return {}
    
    # Подготавливаем данные для ИИ
    category_limits_str = "\n".join([f"- {name}: {limit} {currency}" for name, limit in questionnaire.category_limits.items()])
    
    problems_info = ""
    if questionnaire.problems_text:
        problems_info += f"Текст пользователя: {questionnaire.problems_text}\n"
    if questionnaire.problems_options:
        problems_info += f"Выбранные варианты: {', '.join(questionnaire.problems_options)}"
    
    goal_info = ""
    if questionnaire.goal_text:
        goal_info += f"Текст пользователя: {questionnaire.goal_text}\n"
    if questionnaire.goal_options:
        goal_info += f"Выбранные варианты: {', '.join(questionnaire.goal_options)}"
    
    prompt = f"""Ты - финансовый консультант. Проанализируй анкету пользователя и дай рекомендации.

Данные пользователя:
- Месячный доход: {questionnaire.monthly_income} {currency}
- Лимиты категорий (фактические траты пользователя):
{category_limits_str}

Проблемы пользователя:
{problems_info if problems_info else "Не указаны"}

Цель пользователя:
{goal_info if goal_info else "Не указана"}

Задачи:
1. Кратко резюмируй проблемы пользователя (2-3 предложения)
2. Кратко резюмируй цель пользователя (1-2 предложения)
3. Для каждой категории рассчитай ПЛАНОВЫЙ лимит на месяц (оптимальный), учитывая:
   - Доход пользователя
   - Его проблемы
   - Его цели
   - Разумное распределение бюджета

Ответ должен быть в JSON формате:
{{
  "problems_summary": "краткое резюме проблем",
  "goal_summary": "краткое резюме цели",
  "recommended_limits": {{
    "Категория1": число,
    "Категория2": число,
    ...
  }},
  "reasoning": "краткое объяснение рекомендаций"
}}

Важно: recommended_limits должны быть числами, не строками. Включи все категории из анкеты."""

    if force_recalculate:
        prompt += "\n\nВажно: доход пользователя изменился. Пересчитай плановые лимиты заново на основе нового дохода. Не оставляй прежние значения без пересчета."

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            assistant.client.generate_content,
            prompt
        )
        
        response_text = response.text if hasattr(response, 'text') else str(response)
        
        # Парсим JSON ответ
        # ИИ может вернуть код блок с JSON, извлекаем JSON
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        ai_data = json.loads(response_text)
        
        return {
            "problems_summary": ai_data.get("problems_summary", ""),
            "goal_summary": ai_data.get("goal_summary", ""),
            "recommended_limits": ai_data.get("recommended_limits", {}),
            "reasoning": ai_data.get("reasoning", "")
        }
        
    except Exception as e:
        logger.error(f"Error parsing AI response: {e}")
        return {}


async def create_goals_from_biography(
    biography: Biography,
    questionnaire: QuestionnaireRequest,
    current_user: User,
    db: Session
):
    """Создать цели из биографии"""
    if not questionnaire.goal_text and not questionnaire.goal_options:
        return
    
    # Создаем цель на основе ответа пользователя
    goal_name = "Достичь финансовых целей"
    if questionnaire.goal_options:
        goal_name = questionnaire.goal_options[0] if len(questionnaire.goal_options) > 0 else goal_name
    elif questionnaire.goal_text:
        # Берем первые слова из текста как название
        goal_name = questionnaire.goal_text[:50] if len(questionnaire.goal_text) > 50 else questionnaire.goal_text
    
    goal_description = questionnaire.goal_text if questionnaire.goal_text else ", ".join(questionnaire.goal_options) if questionnaire.goal_options else None
    
    # Рассчитываем целевую сумму на основе дохода (например, 3 месяца дохода)
    target_amount = questionnaire.monthly_income * 3
    
    goal = Goal(
        user_id=current_user.id,
        goal_type=GoalType.SAVE,
        name=goal_name[:15],  # Ограничение длины имени
        description=goal_description,
        target_amount=target_amount,
        currency=current_user.default_currency,
        start_date=datetime.utcnow(),
        target_date=datetime.utcnow() + timedelta(days=90),  # 3 месяца
        status=GoalStatus.ACTIVE
    )
    
    db.add(goal)
    db.flush()


@router.get("", response_model=Optional[BiographyResponse])
async def get_biography(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить текущую биографию пользователя"""
    biography = db.query(Biography).filter(
        Biography.user_id == current_user.id,
        Biography.is_current == True
    ).first()
    
    if not biography:
        return None
    
    # Обновляем фактические траты
    update_actual_spending(biography, current_user, db)
    
    db.refresh(biography)
    return biography


def update_actual_spending(biography: Biography, user: User, db: Session):
    """Обновить фактические траты по категориям за текущий месяц"""
    # Получаем начало и конец текущего месяца
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    
    # Получаем все транзакции расходов за месяц
    transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id,
        Transaction.transaction_type == TransactionType.EXPENSE,
        Transaction.transaction_date >= month_start,
        Transaction.transaction_date < month_end
    ).all()
    
    # Группируем по категориям
    spending_by_category = {}
    for trans in transactions:
        if trans.category:
            category_name = trans.category.name
            if category_name not in spending_by_category:
                spending_by_category[category_name] = Decimal(0)
            spending_by_category[category_name] += Decimal(str(trans.amount))
    
    # Обновляем фактические траты в лимитах
    for limit in biography.category_limits:
        if limit.category_name in spending_by_category:
            limit.actual_spent = spending_by_category[limit.category_name]
        else:
            limit.actual_spent = Decimal(0)
    
    db.commit()


@router.get("/history", response_model=list[BiographyResponse])
async def get_biography_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить историю биографий пользователя"""
    biographies = db.query(Biography).filter(
        Biography.user_id == current_user.id
    ).order_by(Biography.created_at.desc()).all()
    
    return biographies


@router.put("/income", response_model=BiographyResponse)
async def update_income(
    request: UpdateIncomeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить доход в биографии"""
    biography = db.query(Biography).filter(
        Biography.user_id == current_user.id,
        Biography.is_current == True
    ).first()
    
    if not biography:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Биография не найдена"
        )
    
    biography.monthly_income = request.monthly_income
    
    # Обновляем также в questionnaire_response если есть
    if biography.questionnaire_response:
        biography.questionnaire_response.monthly_income = request.monthly_income
    
    db.commit()
    db.refresh(biography)
    
    # Обновляем фактические траты
    update_actual_spending(biography, current_user, db)
    
    return biography


@router.post("/update-category-limits", response_model=BiographyResponse)
async def update_category_limits(
    request: UpdateCategoryLimitsRequest = Body(default={}),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить лимиты категорий через ИИ (стоимость: 1 сердце Люси)"""
    HEARTS_COST = 1
    
    # Проверяем баланс сердец
    profile = get_or_create_profile(current_user.id, db)
    
    if profile.heart_level < HEARTS_COST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостаточно сердец Люси. Требуется {HEARTS_COST}, доступно {profile.heart_level}. Заработайте больше сердец или приобретите премиум."
        )
    
    biography = db.query(Biography).filter(
        Biography.user_id == current_user.id,
        Biography.is_current == True
    ).first()
    
    if not biography:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Биография не найдена"
        )
    
    if not biography.monthly_income:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала укажите ваш доход"
        )
    
    # Списываем сердца
    profile.heart_level -= HEARTS_COST
    db.commit()
    
    # Получаем данные анкетирования
    questionnaire_response = biography.questionnaire_response
    if not questionnaire_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Данные анкетирования не найдены"
        )
    
    # Подготавливаем данные для ИИ
    category_limits = {}
    if biography.category_limits:
        category_limits = {
            limit.category_name: Decimal(str(limit.user_limit))
            for limit in biography.category_limits
            if limit.user_limit is not None
        }
    elif questionnaire_response.category_limits:
        category_limits = {
            k: Decimal(str(v))
            for k, v in questionnaire_response.category_limits.items()
        }
    
    # Создаем временный QuestionnaireRequest для анализа
    from app.schemas.biography import QuestionnaireRequest
    # problems_options и goal_options уже являются Python объектами (JSON колонка в SQLAlchemy)
    # Не нужно использовать json.loads()
    temp_questionnaire = QuestionnaireRequest(
        category_limits=category_limits,
        monthly_income=biography.monthly_income or questionnaire_response.monthly_income or Decimal(0),
        problems_text=questionnaire_response.problems_text,
        problems_options=questionnaire_response.problems_options if questionnaire_response.problems_options else None,
        goal_text=questionnaire_response.goal_text,
        goal_options=questionnaire_response.goal_options if questionnaire_response.goal_options else None
    )
    
    # Анализируем через ИИ
    try:
        ai_analysis = await analyze_questionnaire_with_ai(
            questionnaire=temp_questionnaire,
            currency=current_user.default_currency,
            db=db,
            current_user=current_user,
            force_recalculate=True
        )
        
        # Обновляем плановые лимиты от ИИ
        if ai_analysis.get("recommended_limits"):
            for limit in biography.category_limits:
                category_name = limit.category_name
                if category_name in ai_analysis["recommended_limits"]:
                    limit.ai_recommended_limit = Decimal(str(ai_analysis["recommended_limits"][category_name]))
        
        # Обновляем фактические траты
        update_actual_spending(biography, current_user, db)
        
        db.commit()
        db.refresh(biography)
        
        return biography
        
    except Exception as e:
        logger.error(f"Error updating category limits with AI: {e}")
        # Возвращаем сердца при ошибке
        profile.heart_level += HEARTS_COST
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении лимитов: {str(e)}"
        )
