from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_, text as sa_text
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
    
    # Get transactions in period using raw SQL to avoid enum issues
    if not all_account_ids:
        transactions_data = []
    else:
        placeholders = ','.join([f':acc_{i}' for i in range(len(all_account_ids))])
        params = {f"acc_{i}": acc_id for i, acc_id in enumerate(all_account_ids)}
        params["start_date"] = start_date
        params["end_date"] = end_date
        
        sql_query = f"""
            SELECT 
                id, account_id, transaction_type::text, amount, currency,
                category_id, description, goal_id, transaction_date,
                amount_in_default_currency
            FROM transactions
            WHERE account_id IN ({placeholders})
            AND transaction_date >= :start_date
            AND transaction_date <= :end_date
        """
        
        result = db.execute(sa_text(sql_query), params)
        transactions_data = result.fetchall()
    
    # Calculate totals - convert Decimal to float for consistency
    total_income = 0.0
    total_expense = 0.0
    total_transfer = 0.0
    
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        amount = float(row[3]) if row[3] else 0.0
        
        if trans_type == 'income':
            total_income += amount
        elif trans_type == 'expense':
            total_expense += amount
        elif trans_type == 'transfer':
            total_transfer += amount
    
    net_flow = total_income - total_expense
    
    # Expenses by category
    expenses_by_category = {}
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        category_id = row[5]
        
        if trans_type == 'expense' and category_id:
            category = db.query(Category).filter(Category.id == category_id).first()
            if category and category.is_active:  # Only count active categories
                cat_name = category.name
                cat_icon = category.icon or "📦"
                # Use amount_in_default_currency if available, otherwise use amount
                # Convert Decimal to float for proper summation
                try:
                    amount_value = float(row[9]) if row[9] is not None else float(row[3])
                except (ValueError, TypeError, IndexError):
                    amount_value = float(row[3]) if row[3] else 0.0
                
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
        goal_income = 0.0
        for row in transactions_data:
            if row[7] == goal.id:  # goal_id
                trans_type = row[2].lower() if row[2] else ''
                if trans_type == 'income':
                    goal_income += float(row[3]) if row[3] else 0.0
        
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
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        category_id = row[5]
        
        if trans_type == 'income' and category_id:
            category = db.query(Category).filter(Category.id == category_id).first()
            if category and category.is_active:  # Only count active categories
                cat_name = category.name
                cat_icon = category.icon or "💰"
                # Use amount_in_default_currency if available, otherwise use amount
                # Convert Decimal to float for proper summation
                try:
                    amount_value = float(row[9]) if row[9] is not None else float(row[3])
                except (ValueError, TypeError, IndexError):
                    amount_value = float(row[3]) if row[3] else 0.0
                
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
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        transaction_date = row[8]  # transaction_date
        amount = float(row[3]) if row[3] else 0.0
        
        if transaction_date:
            date_key = transaction_date.date().isoformat() if hasattr(transaction_date, 'date') else str(transaction_date)[:10]
            if date_key not in daily_flow:
                daily_flow[date_key] = {"date": date_key, "income": 0, "expense": 0}
            
            if trans_type == 'income':
                daily_flow[date_key]["income"] += amount
            elif trans_type == 'expense':
                daily_flow[date_key]["expense"] += amount
    
    # Sort by date
    daily_flow_list = sorted(daily_flow.values(), key=lambda x: x["date"])
    
    # Monthly comparison
    # For year period, show 12 months, otherwise show 3 months
    months_count = 12 if period == "year" else 3
    monthly_data = []
    for i in range(months_count):
        month_start = (end_date.replace(day=1) - timedelta(days=32*i)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        # Get month transactions using raw SQL
        if not all_account_ids:
            month_transactions_data = []
        else:
            placeholders = ','.join([f':macc_{i}' for i in range(len(all_account_ids))])
            month_params = {f"macc_{i}": acc_id for i, acc_id in enumerate(all_account_ids)}
            month_params["month_start"] = month_start
            month_params["month_end"] = month_end
            
            month_sql = f"""
                SELECT transaction_type::text, amount
                FROM transactions
                WHERE account_id IN ({placeholders})
                AND transaction_date >= :month_start
                AND transaction_date <= :month_end
            """
            
            month_result = db.execute(sa_text(month_sql), month_params)
            month_transactions_data = month_result.fetchall()
        
        month_income = 0.0
        month_expense = 0.0
        for row in month_transactions_data:
            trans_type = row[0].lower() if row[0] else ''
            amount = float(row[1]) if row[1] else 0.0
            
            if trans_type == 'income':
                month_income += amount
            elif trans_type == 'expense':
                month_expense += amount
        
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
    
    if len(transactions_data) > 0:
        expense_count = sum(1 for row in transactions_data if row[2] and row[2].lower() == 'expense')
        avg_transaction = total_expense / expense_count if expense_count > 0 else 0.0
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
        "transaction_count": len(transactions_data),
        "goals": goals_info
    }

