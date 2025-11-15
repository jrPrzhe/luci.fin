from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.gamification import UserGamificationProfile
from app.ai.assistant import AIAssistant

router = APIRouter()
logger = logging.getLogger(__name__)


class AnalyzeRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    balance: float
    currency: str


class AnalyzeResponse(BaseModel):
    insights: str
    recommendations: List[str] = []
    anomalies: List[Dict[str, Any]] = []


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_transactions(
    request: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze user's transactions using AI"""
    assistant = AIAssistant()
    
    if not assistant.client:
        # Fallback: simple analysis without AI
        return generate_fallback_analysis(request.transactions, request.balance, request.currency)
    
    try:
        # Prepare data for AI
        transactions_summary = []
        income_total = 0
        expense_total = 0
        
        for trans in request.transactions[:50]:  # Limit to 50 transactions
            trans_type = trans.get("transaction_type", "")
            amount = trans.get("amount", 0)
            # Use description if available and valid, otherwise use category_name, otherwise "Без описания"
            desc = trans.get("description")
            cat_name = trans.get("category_name")
            if desc and str(desc).strip() and str(desc).strip() not in ('None', 'null'):
                description = str(desc).strip()
            elif cat_name and str(cat_name).strip() and str(cat_name).strip() not in ('None', 'null'):
                description = str(cat_name).strip()
            else:
                description = "Без описания"
            date = trans.get("transaction_date", "")[:10]
            
            if trans_type == "income":
                income_total += amount
            elif trans_type == "expense":
                expense_total += amount
            
            transactions_summary.append({
                "type": trans_type,
                "amount": amount,
                "description": description,
                "date": date
            })
        
        # Build prompt for AI
        prompt = f"""Ты - финансовый аналитик. Проанализируй следующие финансовые данные пользователя и дай краткие, полезные рекомендации.

Данные:
- Общий баланс: {int(round(request.balance)):,} {request.currency}
- Всего доходов: {int(round(income_total)):,} {request.currency}
- Всего расходов: {int(round(expense_total)):,} {request.currency}
- Количество транзакций: {len(request.transactions)}

Последние транзакции:
"""
        for i, trans in enumerate(transactions_summary[:20], 1):
            icon = "💰" if trans["type"] == "income" else "💸"
            prompt += f"{i}. {icon} {int(round(trans['amount'])):,} {request.currency} - {trans['description']} ({trans['date']})\n"
        
        prompt += f"""

Проанализируй эти данные и дай:
1. Краткий анализ финансового состояния (2-3 предложения)
2. Выявленные проблемы или паттерны
3. Практические рекомендации по улучшению финансового положения (2-3 пункта)

Ответ должен быть на русском языке, кратким и полезным (не более 5-6 предложений)."""

        # Get AI response
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            assistant.client.generate_content,
            prompt
        )
        
        insights = response.text if hasattr(response, 'text') else str(response)
        
        # Generate recommendations
        recommendations = []
        if expense_total > income_total:
            recommendations.append("⚠️ Расходы превышают доходы. Необходимо сократить траты или увеличить доходы.")
        elif expense_total > income_total * 0.8:
            recommendations.append("💡 Расходы составляют более 80% от доходов. Рассмотрите возможность оптимизации бюджета.")
        
        savings_rate = ((income_total - expense_total) / income_total * 100) if income_total > 0 else 0
        if savings_rate < 10:
            recommendations.append("💰 Рекомендуется откладывать минимум 10% от доходов. Сейчас это не выполняется.")
        
        # Detect anomalies (simple: large expenses)
        anomalies = []
        avg_expense = expense_total / len([t for t in request.transactions if t.get("transaction_type") == "expense"]) if any(t.get("transaction_type") == "expense" for t in request.transactions) else 0
        for trans in request.transactions:
            if trans.get("transaction_type") == "expense":
                amount = trans.get("amount", 0)
                if avg_expense > 0 and amount > avg_expense * 3:  # Expense is 3x average
                    # Use description if available and valid, otherwise use category_name, otherwise "Без описания"
                    desc = trans.get("description")
                    cat_name = trans.get("category_name")
                    if desc and str(desc).strip() and str(desc).strip() not in ('None', 'null'):
                        desc_text = str(desc).strip()
                    elif cat_name and str(cat_name).strip() and str(cat_name).strip() not in ('None', 'null'):
                        desc_text = str(cat_name).strip()
                    else:
                        desc_text = "Без описания"
                    anomalies.append({
                        "description": desc_text,
                        "amount": amount,
                        "date": trans.get("transaction_date", "")[:10],
                        "reason": "Необычно большой расход"
                    })
        
        return AnalyzeResponse(
            insights=insights,
            recommendations=recommendations[:3],
            anomalies=anomalies[:5]
        )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"AI analysis error: {e}")
        # Return fallback analysis
        return generate_fallback_analysis(request.transactions, request.balance, request.currency)


def generate_fallback_analysis(transactions: List[Dict], balance: float, currency: str) -> AnalyzeResponse:
    """Generate simple analysis without AI"""
    income_total = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "income")
    expense_total = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "expense")
    
    insights_parts = []
    
    if expense_total > income_total:
        insights_parts.append("⚠️ Ваши расходы превышают доходы. Это негативная тенденция.")
    elif expense_total > income_total * 0.8:
        insights_parts.append("💡 Расходы составляют более 80% от доходов - есть потенциал для оптимизации.")
    else:
        insights_parts.append("✅ Финансовое положение стабильное.")
    
    savings = income_total - expense_total
    if savings > 0:
        savings_rate = (savings / income_total * 100) if income_total > 0 else 0
        insights_parts.append(f"Ваш баланс: {int(round(balance)):,} {currency}. Накопления: {int(round(savings)):,} {currency} ({savings_rate:.1f}% от доходов).")
    
    recommendations = []
    if expense_total > income_total:
        recommendations.append("Необходимо сократить расходы или найти дополнительные источники дохода.")
    if savings < income_total * 0.1:
        recommendations.append("Рекомендуется откладывать минимум 10% от доходов.")
    
    insights = " ".join(insights_parts)
    
    return AnalyzeResponse(
        insights=insights,
        recommendations=recommendations,
        anomalies=[]
    )


class GamificationMessageRequest(BaseModel):
    """Запрос на генерацию сообщения от Люси"""
    event: str  # streak_broken, level_up, achievement_unlocked, daily_greeting, etc.
    user_data: Optional[Dict[str, Any]] = None  # Дополнительные данные о пользователе


class GamificationMessageResponse(BaseModel):
    """Ответ с сообщением от Люси"""
    message: str
    emotion: str  # happy, sad, neutral, proud, etc.


@router.post("/gamification-message", response_model=GamificationMessageResponse)
async def generate_gamification_message(
    request: GamificationMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Генерировать тёплое, эмоциональное сообщение от имени Люси"""
    assistant = AIAssistant()
    
    # Получаем профиль геймификации
    from app.api.v1.gamification import get_or_create_profile
    profile = get_or_create_profile(current_user.id, db)
    
    # Строим контекст для промпта
    user_name = current_user.first_name or current_user.username or "друг"
    streak_days = profile.streak_days
    level = profile.level
    heart_level = profile.heart_level
    
    # Определяем эмоцию в зависимости от события
    emotion_map = {
        "streak_broken": "sad",
        "level_up": "proud",
        "achievement_unlocked": "happy",
        "daily_greeting": "warm",
        "first_transaction": "encouraging",
        "streak_milestone": "excited",
    }
    emotion = emotion_map.get(request.event, "neutral")
    
    # Создаём промпт в зависимости от события
    if request.event == "streak_broken":
        prompt = f"""Ты - Люся, тёплый и понимающий ИИ-ассистент в приложении для учёта финансов. 
Пользователь {user_name} пропустил день и потерял страйк ({streak_days} дней подряд).
Сердце Люси: {heart_level}/100.

Напиши короткое, тёплое сообщение (2-3 предложения) с пониманием и поддержкой. 
Не дави на пользователя, не упрекай. Просто покажи, что ты понимаешь, что бывает трудно, 
и что ты будешь ждать его возвращения. Будь философским, как дневник друга.

Стиль: тёплый, поддерживающий, без давления, немного меланхоличный, но с надеждой.
Пример тона: "Я знаю, бывает. Ты не один. Я буду здесь, когда вернёшься."

Ответ должен быть только текстом сообщения, без дополнительных пояснений."""
    
    elif request.event == "level_up":
        prompt = f"""Ты - Люся, тёплый и поддерживающий ИИ-ассистент в приложении для учёта финансов.
Пользователь {user_name} поднялся на уровень {level}!
Сердце Люси: {heart_level}/100.

Напиши короткое, радостное и гордое сообщение (2-3 предложения), поздравляя пользователя.
Будь искренней, покажи, что ты гордишься им. Используй философский, вдохновляющий тон.

Стиль: радостный, гордый, вдохновляющий, философский.
Пример тона: "Ты не просто ведёшь бюджет. Ты ведёшь себя."

Ответ должен быть только текстом сообщения, без дополнительных пояснений."""
    
    elif request.event == "achievement_unlocked":
        achievement_name = request.user_data.get("achievement_name", "достижение") if request.user_data else "достижение"
        prompt = f"""Ты - Люся, тёплый и поддерживающий ИИ-ассистент в приложении для учёта финансов.
Пользователь {user_name} разблокировал достижение: {achievement_name}!
Сердце Люси: {heart_level}/100.

Напиши короткое, радостное сообщение (2-3 предложения), поздравляя с достижением.
Будь искренней и покажи, что ты замечаешь его усилия.

Стиль: радостный, поддерживающий, тёплый.
Ответ должен быть только текстом сообщения, без дополнительных пояснений."""
    
    elif request.event == "daily_greeting":
        prompt = f"""Ты - Люся, тёплый и заботливый ИИ-ассистент в приложении для учёта финансов.
Пользователь {user_name} открыл приложение утром.
Страйк: {streak_days} дней подряд.
Уровень: {level}
Сердце Люси: {heart_level}/100.

Напиши короткое, тёплое утреннее приветствие (2-3 предложения).
Покажи, что ты рада его видеть, напомни о страйке и квестах на сегодня.
Будь дружелюбной, но не навязчивой.

Стиль: тёплый, дружелюбный, мотивирующий, но не давящий.
Ответ должен быть только текстом сообщения, без дополнительных пояснений."""
    
    elif request.event == "first_transaction":
        prompt = f"""Ты - Люся, тёплый и поддерживающий ИИ-ассистент в приложении для учёта финансов.
Пользователь {user_name} только что создал свою первую транзакцию!
Сердце Люси: {heart_level}/100.

Напиши короткое, ободряющее сообщение (2-3 предложения), поздравляя с первым шагом.
Покажи, что ты рада начать этот путь вместе с ним.

Стиль: ободряющий, тёплый, вдохновляющий.
Ответ должен быть только текстом сообщения, без дополнительных пояснений."""
    
    else:
        # Общее сообщение
        prompt = f"""Ты - Люся, тёплый и поддерживающий ИИ-ассистент в приложении для учёта финансов.
Пользователь {user_name}. Событие: {request.event}.
Сердце Люси: {heart_level}/100.

Напиши короткое, тёплое сообщение (2-3 предложения) в ответ на это событие.
Будь поддерживающей, философской, как дневник друга.

Стиль: тёплый, поддерживающий, философский.
Ответ должен быть только текстом сообщения, без дополнительных пояснений."""
    
    if not assistant.client:
        # Fallback сообщения
        fallback_messages = {
            "streak_broken": "Я знаю, бывает. Ты не один. Я буду здесь, когда вернёшься. ❤️",
            "level_up": f"Поздравляю! Ты поднялся на уровень {level}. Ты не просто ведёшь бюджет. Ты ведёшь себя. 🌟",
            "achievement_unlocked": "Отлично! Ты разблокировал достижение. Я горжусь тобой! 🎉",
            "daily_greeting": f"Доброе утро, {user_name}! Ты на {streak_days}-й день. Люся ждёт тебя. ❤️",
            "first_transaction": "Твой первый шаг! Я рада начать этот путь вместе с тобой. 💫",
        }
        message = fallback_messages.get(request.event, "Привет! Я здесь, чтобы поддержать тебя. ❤️")
        return GamificationMessageResponse(message=message, emotion=emotion)
    
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            assistant.client.generate_content,
            prompt
        )
        
        message = response.text if hasattr(response, 'text') else str(response)
        # Очищаем сообщение от лишних символов
        message = message.strip().strip('"').strip("'")
        
        return GamificationMessageResponse(message=message, emotion=emotion)
        
    except Exception as e:
        logger.error(f"AI gamification message error: {e}")
        # Fallback
        fallback_messages = {
            "streak_broken": "Я знаю, бывает. Ты не один. Я буду здесь, когда вернёшься. ❤️",
            "level_up": f"Поздравляю! Ты поднялся на уровень {level}. Ты не просто ведёшь бюджет. Ты ведёшь себя. 🌟",
            "achievement_unlocked": "Отлично! Ты разблокировал достижение. Я горжусь тобой! 🎉",
            "daily_greeting": f"Доброе утро, {user_name}! Ты на {streak_days}-й день. Люся ждёт тебя. ❤️",
            "first_transaction": "Твой первый шаг! Я рада начать этот путь вместе с тобой. 💫",
        }
        message = fallback_messages.get(request.event, "Привет! Я здесь, чтобы поддержать тебя. ❤️")
        return GamificationMessageResponse(message=message, emotion=emotion)

