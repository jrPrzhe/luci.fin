from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account
from app.models.category import Category
from app.models.goal import Goal, GoalStatus

router = APIRouter()


@router.get("/analytics", response_model=Dict[str, Any])
async def get_analytics(
    period: Optional[str] = "month",  # "week", "month", "year"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get financial analytics for the user"""
    from app.models.shared_budget import SharedBudgetMember
    
    # Calculate date range
    end_date = datetime.utcnow()
    if period == "week":
        start_date = end_date - timedelta(days=7)
    elif period == "month":
        start_date = end_date - timedelta(days=30)
    elif period == "year":
        start_date = end_date - timedelta(days=365)
    else:
        start_date = end_date - timedelta(days=30)
    
    # Get user's accounts
    user_accounts = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.is_active == True
    ).all()
    account_ids = [acc.id for acc in user_accounts]
    
    # Get shared budget accounts
    budget_memberships = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.user_id == current_user.id
    ).all()
    budget_ids = [m.shared_budget_id for m in budget_memberships]
    
    shared_account_ids = []
    if budget_ids:
        shared_accounts = db.query(Account).filter(
            Account.shared_budget_id.in_(budget_ids),
            Account.is_active == True
        ).all()
        shared_account_ids = [acc.id for acc in shared_accounts]
    
    all_account_ids = account_ids + shared_account_ids
    
    # Get transactions in period
    transactions_query = db.query(Transaction).filter(
        Transaction.account_id.in_(all_account_ids) if all_account_ids else Transaction.id == -1,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    )
    
    transactions = transactions_query.all()
    
    # Calculate totals - convert Decimal to float for consistency
    total_income = float(sum(float(t.amount) for t in transactions if t.transaction_type == TransactionType.INCOME))
    total_expense = float(sum(float(t.amount) for t in transactions if t.transaction_type == TransactionType.EXPENSE))
    total_transfer = float(sum(float(t.amount) for t in transactions if t.transaction_type == TransactionType.TRANSFER))
    net_flow = total_income - total_expense
    
    # Expenses by category
    expenses_by_category = {}
    for trans in transactions:
        if trans.transaction_type == TransactionType.EXPENSE and trans.category_id:
            category = db.query(Category).filter(Category.id == trans.category_id).first()
            if category and category.is_active:  # Only count active categories
                cat_name = category.name
                cat_icon = category.icon or "📦"
                # Use amount_in_default_currency if available, otherwise use amount
                # Convert Decimal to float for proper summation
                try:
                    amount_value = float(trans.amount_in_default_currency) if trans.amount_in_default_currency is not None else float(trans.amount)
                except (ValueError, TypeError):
                    amount_value = float(trans.amount)
                
                if cat_name not in expenses_by_category:
                    expenses_by_category[cat_name] = {
                        "name": cat_name,
                        "icon": cat_icon,
                        "amount": 0.0,
                        "color": category.color or "#607D8B"
                    }
                expenses_by_category[cat_name]["amount"] += amount_value
    
    # Goals information
    active_goals = db.query(Goal).filter(
        Goal.user_id == current_user.id,
        Goal.status == GoalStatus.ACTIVE
    ).all()
    
    goals_info = []
    for goal in active_goals:
        # Get transactions related to this goal
        goal_transactions = [t for t in transactions if t.goal_id == goal.id]
        goal_income = sum(float(t.amount) for t in goal_transactions if t.transaction_type == TransactionType.INCOME)
        
        goals_info.append({
            "id": goal.id,
            "name": goal.name,
            "target_amount": float(goal.target_amount),
            "current_amount": float(goal.current_amount),
            "progress_percentage": goal.progress_percentage,
            "currency": goal.currency,
            "saved_in_period": goal_income,
            "remaining": float(goal.target_amount - goal.current_amount)
        })
    
    # Sort by amount and take top 10
    top_expense_categories = sorted(
        expenses_by_category.values(),
        key=lambda x: x["amount"],
        reverse=True
    )[:10]
    
    # Income by category
    income_by_category = {}
    for trans in transactions:
        if trans.transaction_type == TransactionType.INCOME and trans.category_id:
            category = db.query(Category).filter(Category.id == trans.category_id).first()
            if category and category.is_active:  # Only count active categories
                cat_name = category.name
                cat_icon = category.icon or "💰"
                # Use amount_in_default_currency if available, otherwise use amount
                # Convert Decimal to float for proper summation
                try:
                    amount_value = float(trans.amount_in_default_currency) if trans.amount_in_default_currency is not None else float(trans.amount)
                except (ValueError, TypeError):
                    amount_value = float(trans.amount)
                
                if cat_name not in income_by_category:
                    income_by_category[cat_name] = {
                        "name": cat_name,
                        "icon": cat_icon,
                        "amount": 0.0,
                        "color": category.color or "#4CAF50"
                    }
                income_by_category[cat_name]["amount"] += amount_value
    
    top_income_categories = sorted(
        income_by_category.values(),
        key=lambda x: x["amount"],
        reverse=True
    )[:10]
    
    # Daily flow (for line chart)
    daily_flow = {}
    for trans in transactions:
        date_key = trans.transaction_date.date().isoformat()
        if date_key not in daily_flow:
            daily_flow[date_key] = {"date": date_key, "income": 0, "expense": 0}
        
        if trans.transaction_type == TransactionType.INCOME:
            daily_flow[date_key]["income"] += float(trans.amount)
        elif trans.transaction_type == TransactionType.EXPENSE:
            daily_flow[date_key]["expense"] += float(trans.amount)
    
    # Sort by date
    daily_flow_list = sorted(daily_flow.values(), key=lambda x: x["date"])
    
    # Monthly comparison
    # For year period, show 12 months, otherwise show 3 months
    months_count = 12 if period == "year" else 3
    monthly_data = []
    for i in range(months_count):
        month_start = (end_date.replace(day=1) - timedelta(days=32*i)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        month_transactions = db.query(Transaction).filter(
            Transaction.account_id.in_(all_account_ids) if all_account_ids else Transaction.id == -1,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_date <= month_end
        ).all()
        
        month_income = float(sum(float(t.amount) for t in month_transactions if t.transaction_type == TransactionType.INCOME))
        month_expense = float(sum(float(t.amount) for t in month_transactions if t.transaction_type == TransactionType.EXPENSE))
        
        monthly_data.append({
            "month": month_start.strftime("%B %Y"),
            "month_short": month_start.strftime("%b"),
            "income": month_income,
            "expense": month_expense,
            "net": month_income - month_expense
        })
    
    monthly_data.reverse()  # Oldest first
    
    # Generate interesting facts
    facts = []
    
    if total_expense > 0:
        avg_daily_expense = total_expense / max(len(daily_flow_list), 1)
        facts.append({
            "icon": "📊",
            "text": f"Средний расход в день: {avg_daily_expense:,.0f} {current_user.default_currency}",
            "type": "stat"
        })
    
    if total_income > 0:
        savings_rate = (net_flow / total_income * 100) if total_income > 0 else 0
        if savings_rate > 0:
            facts.append({
                "icon": "💰",
                "text": f"Накопления: {savings_rate:.1f}% от дохода",
                "type": "positive"
            })
        elif savings_rate < -20:
            facts.append({
                "icon": "⚠️",
                "text": f"Расходы превышают доходы на {abs(savings_rate):.1f}%",
                "type": "warning"
            })
    
    if top_expense_categories:
        top_cat = top_expense_categories[0]
        top_percent = (top_cat["amount"] / total_expense * 100) if total_expense > 0 else 0
        facts.append({
            "icon": top_cat["icon"],
            "text": f"Больше всего тратите на {top_cat['name']}: {top_percent:.1f}%",
            "type": "info"
        })
    
    if len(transactions) > 0:
        expense_transactions = [t for t in transactions if t.transaction_type == TransactionType.EXPENSE]
        avg_transaction = total_expense / len(expense_transactions) if len(expense_transactions) > 0 else 0.0
        facts.append({
            "icon": "💳",
            "text": f"Средний чек: {avg_transaction:,.0f} {current_user.default_currency}",
            "type": "stat"
        })
    
    if monthly_data and len(monthly_data) >= 2:
        last_month = monthly_data[-1]
        prev_month = monthly_data[-2] if len(monthly_data) >= 2 else None
        if prev_month and prev_month["expense"] > 0:
            change = float((last_month["expense"] - prev_month["expense"]) / prev_month["expense"]) * 100
            if abs(change) > 5:
                facts.append({
                    "icon": "📈" if change < 0 else "📉",
                    "text": f"Расходы {'снизились' if change < 0 else 'выросли'} на {abs(change):.1f}% по сравнению с предыдущим месяцем",
                    "type": "trend"
                })
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "totals": {
            "income": total_income,
            "expense": total_expense,
            "net": net_flow,
            "currency": current_user.default_currency
        },
        "top_expense_categories": top_expense_categories,
        "top_income_categories": top_income_categories,
        "daily_flow": daily_flow_list,
        "monthly_comparison": monthly_data,
        "facts": facts,
        "transaction_count": len(transactions),
        "goals": goals_info
    }

