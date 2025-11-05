from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.ai.assistant import AIAssistant

router = APIRouter()


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

