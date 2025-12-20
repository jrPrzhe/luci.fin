from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_, text as sa_text
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import logging
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account
from app.models.category import Category
from app.models.goal import Goal, GoalStatus
from app.services.premium import require_premium
from app.services.report_generator import PremiumReportGenerator
import io

router = APIRouter()
logger = logging.getLogger(__name__)

# Russian month names
RUSSIAN_MONTHS = {
    1: 'Январь', 2: 'Февраль', 3: 'Март', 4: 'Апрель',
    5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Август',
    9: 'Сентябрь', 10: 'Октябрь', 11: 'Ноябрь', 12: 'Декабрь'
}

RUSSIAN_MONTHS_SHORT = {
    1: 'Янв', 2: 'Фев', 3: 'Мар', 4: 'Апр',
    5: 'Май', 6: 'Июн', 7: 'Июл', 8: 'Авг',
    9: 'Сен', 10: 'Окт', 11: 'Ноя', 12: 'Дек'
}

def format_month_russian(date: datetime, short: bool = False) -> str:
    """Format month name in Russian"""
    month_num = date.month
    if short:
        return RUSSIAN_MONTHS_SHORT[month_num]
    return RUSSIAN_MONTHS[month_num]


@router.get("/analytics", response_model=Dict[str, Any])
async def get_analytics(
    period: Optional[str] = "month",  # "week", "month", "year"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get financial analytics for the user"""
    from app.models.shared_budget import SharedBudgetMember
    
    # Calculate date range - use proper calendar periods
    end_date = datetime.utcnow()
    # Set end_date to end of current day (23:59:59) to include all transactions from today
    end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    if period == "week":
        # Last 7 days (including today)
        start_date = (end_date - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        # Current month from the 1st to today (end of day)
        start_date = datetime(end_date.year, end_date.month, 1, 0, 0, 0)
    elif period == "year":
        # Current year from January 1st to today (end of day)
        start_date = datetime(end_date.year, 1, 1, 0, 0, 0)
    else:
        # Default to current month
        start_date = datetime(end_date.year, end_date.month, 1, 0, 0, 0)
    
    # Get user's accounts (matching get_transactions logic)
    user_accounts = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.is_active == True
    ).all()
    account_ids = [acc.id for acc in user_accounts]
    
    # Get shared budget accounts (matching get_transactions logic)
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
    
    # Separate personal and shared account IDs (needed for queries)
    personal_account_ids = account_ids
    shared_account_ids_list = shared_account_ids
    
    # Get transactions in period using raw SQL to avoid enum issues
    # Match get_transactions logic: user's transactions OR all transactions from shared accounts
    if not all_account_ids:
        transactions_data = []
    else:
        
        # Build query matching get_transactions logic
        # For personal accounts: only user's transactions
        # For shared accounts: all transactions (from all members)
        if shared_account_ids_list:
            # Has shared accounts: (user_id = current_user.id OR account_id IN shared_accounts)
            placeholders_personal = ','.join([f':acc_p_{i}' for i in range(len(personal_account_ids))]) if personal_account_ids else ''
            placeholders_shared = ','.join([f':acc_s_{i}' for i in range(len(shared_account_ids_list))])
            
            params = {}
            if personal_account_ids:
                for i, acc_id in enumerate(personal_account_ids):
                    params[f"acc_p_{i}"] = acc_id
            for i, acc_id in enumerate(shared_account_ids_list):
                params[f"acc_s_{i}"] = acc_id
            params["start_date"] = start_date
            params["end_date"] = end_date
            params["user_id"] = current_user.id
            
            # Build WHERE clause matching get_transactions logic
            where_clauses = []
            if personal_account_ids:
                where_clauses.append(f"account_id IN ({placeholders_personal}) AND user_id = :user_id")
            if shared_account_ids_list:
                where_clauses.append(f"account_id IN ({placeholders_shared})")
            
            where_clause = " OR ".join(where_clauses) if where_clauses else "1=0"
            
            sql_query = f"""
                SELECT 
                    id, account_id, transaction_type::text, amount, currency,
                    category_id, 
                    CASE 
                        WHEN description IS NOT NULL THEN 
                            COALESCE(
                                convert_from(convert_to(description, 'LATIN1'), 'UTF8'),
                                encode(description::bytea, 'escape')::text,
                                description
                            )
                        ELSE NULL
                    END as description,
                    goal_id, transaction_date,
                    amount_in_default_currency, parent_transaction_id, user_id
                FROM transactions
                WHERE ({where_clause})
                AND transaction_date >= :start_date
                AND transaction_date <= :end_date
            """
        else:
            # No shared accounts: only user's transactions
            placeholders = ','.join([f':acc_{i}' for i in range(len(personal_account_ids))])
            params = {f"acc_{i}": acc_id for i, acc_id in enumerate(personal_account_ids)}
            params["start_date"] = start_date
            params["end_date"] = end_date
            params["user_id"] = current_user.id
            
            sql_query = f"""
                SELECT 
                    id, account_id, transaction_type::text, amount, currency,
                    category_id, 
                    CASE 
                        WHEN description IS NOT NULL THEN 
                            COALESCE(
                                convert_from(convert_to(description, 'LATIN1'), 'UTF8'),
                                encode(description::bytea, 'escape')::text,
                                description
                            )
                        ELSE NULL
                    END as description,
                    goal_id, transaction_date,
                    amount_in_default_currency, parent_transaction_id, user_id
                FROM transactions
                WHERE account_id IN ({placeholders})
                AND user_id = :user_id
                AND transaction_date >= :start_date
                AND transaction_date <= :end_date
            """
        
        try:
            result = db.execute(sa_text(sql_query), params)
            transactions_data = result.fetchall()
        except Exception as e:
            error_str = str(e)
            # Check if it's an encoding error
            if "CharacterNotInRepertoire" in error_str or "invalid byte sequence" in error_str:
                logger.error(f"Encoding error in reports query: {e}")
                # Try simpler query without encoding conversions
                try:
                    if shared_account_ids_list:
                        simple_sql = f"""
                            SELECT 
                                id, account_id, transaction_type::text, amount, currency,
                                category_id, description, goal_id, transaction_date,
                                amount_in_default_currency, parent_transaction_id, user_id
                            FROM transactions
                            WHERE ({where_clause})
                            AND transaction_date >= :start_date
                            AND transaction_date <= :end_date
                        """
                    else:
                        simple_sql = f"""
                            SELECT 
                                id, account_id, transaction_type::text, amount, currency,
                                category_id, description, goal_id, transaction_date,
                                amount_in_default_currency, parent_transaction_id, user_id
                            FROM transactions
                            WHERE account_id IN ({placeholders})
                            AND user_id = :user_id
                            AND transaction_date >= :start_date
                            AND transaction_date <= :end_date
                        """
                    logger.warning("Retrying reports query without encoding conversions")
                    result = db.execute(sa_text(simple_sql), params)
                    transactions_data = result.fetchall()
                except Exception as e2:
                    logger.error(f"Fallback query also failed: {e2}")
                    transactions_data = []
            else:
                logger.error(f"Error executing reports query: {e}", exc_info=True)
                raise
    
    # Calculate totals - convert Decimal to float for consistency
    total_income = 0.0
    total_expense = 0.0
    total_transfer = 0.0
    
    logger.info(f"[Analytics] Processing {len(transactions_data)} transactions for period={period}, user_id={current_user.id}")
    logger.info(f"[Analytics] Date range: {start_date} to {end_date}")
    logger.info(f"[Analytics] Personal accounts: {len(personal_account_ids)}, Shared accounts: {len(shared_account_ids_list)}")
    
    # Helper function to safely decode strings
    def safe_decode(value):
        if value is None:
            return None
        if isinstance(value, bytes):
            try:
                return value.decode('utf-8', errors='replace')
            except:
                return value.decode('latin-1', errors='replace')
        if isinstance(value, str):
            try:
                value.encode('utf-8')
                return value
            except UnicodeEncodeError:
                try:
                    return value.encode('latin-1').decode('utf-8', errors='replace')
                except:
                    return value.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        return value
    
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        amount = float(row[3]) if row[3] else 0.0
        description = safe_decode(row[6]) if len(row) > 6 else None
        parent_transaction_id = row[10] if len(row) > 10 else None  # parent_transaction_id is at index 10
        
        # Exclude income transactions that are part of a transfer
        # They either have parent_transaction_id (new transfers) or description starting with "Перевод из" (old transfers)
        is_transfer_income = False
        if parent_transaction_id is not None:
            # New transfers have parent_transaction_id set
            is_transfer_income = True
        elif description:
            # Old transfers have description starting with "Перевод из"
            description_lower = description.strip().lower()
            if description_lower.startswith('перевод из'):
                is_transfer_income = True
        
        if trans_type == 'income' and not is_transfer_income:
            total_income += amount
        elif trans_type == 'expense':
            total_expense += amount
        elif trans_type == 'transfer':
            total_transfer += amount
    
    net_flow = total_income - total_expense
    
    logger.info(f"[Analytics] Calculated totals: income={total_income}, expense={total_expense}, net={net_flow}, transfer={total_transfer}")
    
    # Expenses by category
    # Get all category IDs first, then fetch categories using raw SQL to avoid enum issues
    category_ids = set()
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        category_id = row[5]
        if trans_type == 'expense' and category_id:
            category_ids.add(category_id)
    
    # Fetch categories using raw SQL
    categories_map = {}
    if category_ids:
        placeholders = ','.join([f':cat_{i}' for i in range(len(category_ids))])
        cat_params = {f"cat_{i}": cat_id for i, cat_id in enumerate(category_ids)}
        cat_sql = f"""
            SELECT id, name, icon, color
            FROM categories
            WHERE id IN ({placeholders}) AND is_active = true
        """
        cat_result = db.execute(sa_text(cat_sql), cat_params)
        for cat_row in cat_result:
            categories_map[cat_row[0]] = {
                "name": cat_row[1],
                "icon": cat_row[2] or "📦",
                "color": cat_row[3] or "#607D8B"
            }
    
    expenses_by_category = {}
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        category_id = row[5]
        
        if trans_type == 'expense' and category_id and category_id in categories_map:
            cat_info = categories_map[category_id]
            cat_name = cat_info["name"]
            # Use amount_in_default_currency if available, otherwise use amount
            # Convert Decimal to float for proper summation
            try:
                amount_value = float(row[9]) if row[9] is not None else float(row[3])
            except (ValueError, TypeError, IndexError):
                amount_value = float(row[3]) if row[3] else 0.0
            
            if cat_name not in expenses_by_category:
                expenses_by_category[cat_name] = {
                    "name": cat_name,
                    "icon": cat_info["icon"],
                    "amount": 0.0,
                    "color": cat_info["color"]
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
                description = row[6] if len(row) > 6 else None
                parent_transaction_id = row[10] if len(row) > 10 else None
                
                # Exclude transfer income transactions
                is_transfer_income = False
                if parent_transaction_id is not None:
                    is_transfer_income = True
                elif description:
                    description_lower = description.strip().lower()
                    if description_lower.startswith('перевод из'):
                        is_transfer_income = True
                
                if trans_type == 'income' and not is_transfer_income:
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
    # Reuse categories_map, add income category IDs
    income_category_ids = set()
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        category_id = row[5]
        if trans_type == 'income' and category_id and category_id not in category_ids:
            income_category_ids.add(category_id)
    
    # Fetch income categories if needed
    if income_category_ids:
        placeholders = ','.join([f':icat_{i}' for i in range(len(income_category_ids))])
        icat_params = {f"icat_{i}": cat_id for i, cat_id in enumerate(income_category_ids)}
        icat_sql = f"""
            SELECT id, name, icon, color
            FROM categories
            WHERE id IN ({placeholders}) AND is_active = true
        """
        icat_result = db.execute(sa_text(icat_sql), icat_params)
        for cat_row in icat_result:
            categories_map[cat_row[0]] = {
                "name": cat_row[1],
                "icon": cat_row[2] or "💰",
                "color": cat_row[3] or "#4CAF50"
            }
    
    income_by_category = {}
    for row in transactions_data:
        trans_type = row[2].lower() if row[2] else ''
        category_id = row[5]
        description = row[6] if len(row) > 6 else None
        parent_transaction_id = row[10] if len(row) > 10 else None
        
        # Exclude transfer income transactions
        is_transfer_income = False
        if parent_transaction_id is not None:
            is_transfer_income = True
        elif description:
            description_lower = description.strip().lower()
            if description_lower.startswith('перевод из'):
                is_transfer_income = True
        
        if trans_type == 'income' and not is_transfer_income and category_id and category_id in categories_map:
            cat_info = categories_map[category_id]
            cat_name = cat_info["name"]
            # Use amount_in_default_currency if available, otherwise use amount
            # Convert Decimal to float for proper summation
            try:
                amount_value = float(row[9]) if row[9] is not None else float(row[3])
            except (ValueError, TypeError, IndexError):
                amount_value = float(row[3]) if row[3] else 0.0
            
            if cat_name not in income_by_category:
                income_by_category[cat_name] = {
                    "name": cat_name,
                    "icon": cat_info["icon"],
                    "amount": 0.0,
                    "color": cat_info["color"]
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
        description = safe_decode(row[6]) if len(row) > 6 else None
        parent_transaction_id = row[10] if len(row) > 10 else None
        
        # Exclude transfer income transactions
        is_transfer_income = False
        if parent_transaction_id is not None:
            is_transfer_income = True
        elif description:
            description_lower = description.strip().lower()
            if description_lower.startswith('перевод из'):
                is_transfer_income = True
        
        if transaction_date:
            date_key = transaction_date.date().isoformat() if hasattr(transaction_date, 'date') else str(transaction_date)[:10]
            if date_key not in daily_flow:
                daily_flow[date_key] = {"date": date_key, "income": 0, "expense": 0}
            
            if trans_type == 'income' and not is_transfer_income:
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
        # Используем relativedelta для правильного вычисления месяцев
        month_start = (end_date.replace(day=1) - relativedelta(months=i))
        month_end = (month_start + relativedelta(months=1)) - timedelta(days=1)
        
        # Get month transactions using raw SQL
        # Match get_transactions logic: user's transactions OR all transactions from shared accounts
        month_transactions_data = []
        
        if all_account_ids:
            # Use same logic as main query
            if shared_account_ids_list:
                # Has shared accounts: (user_id = current_user.id OR account_id IN shared_accounts)
                placeholders_personal = ','.join([f':macc_p_{i}' for i in range(len(personal_account_ids))]) if personal_account_ids else ''
                placeholders_shared = ','.join([f':macc_s_{i}' for i in range(len(shared_account_ids_list))])
                
                month_params = {}
                if personal_account_ids:
                    for i, acc_id in enumerate(personal_account_ids):
                        month_params[f"macc_p_{i}"] = acc_id
                for i, acc_id in enumerate(shared_account_ids_list):
                    month_params[f"macc_s_{i}"] = acc_id
                month_params["month_start"] = month_start
                month_params["month_end"] = month_end
                month_params["user_id"] = current_user.id
                
                where_clauses = []
                if personal_account_ids:
                    where_clauses.append(f"account_id IN ({placeholders_personal}) AND user_id = :user_id")
                if shared_account_ids_list:
                    where_clauses.append(f"account_id IN ({placeholders_shared})")
                
                where_clause = " OR ".join(where_clauses) if where_clauses else "1=0"
                
                month_sql = f"""
                    SELECT transaction_type::text, amount, 
                    CASE 
                        WHEN description IS NOT NULL THEN 
                            COALESCE(
                                convert_from(convert_to(description, 'LATIN1'), 'UTF8'),
                                encode(description::bytea, 'escape')::text,
                                description
                            )
                        ELSE NULL
                    END as description,
                    parent_transaction_id
                    FROM transactions
                    WHERE ({where_clause})
                    AND transaction_date >= :month_start
                    AND transaction_date <= :month_end
                """
            else:
                # No shared accounts: only user's transactions
                placeholders = ','.join([f':macc_{i}' for i in range(len(personal_account_ids))])
                month_params = {f"macc_{i}": acc_id for i, acc_id in enumerate(personal_account_ids)}
                month_params["month_start"] = month_start
                month_params["month_end"] = month_end
                month_params["user_id"] = current_user.id
                
                month_sql = f"""
                    SELECT transaction_type::text, amount, 
                    CASE 
                        WHEN description IS NOT NULL THEN 
                            COALESCE(
                                convert_from(convert_to(description, 'LATIN1'), 'UTF8'),
                                encode(description::bytea, 'escape')::text,
                                description
                            )
                        ELSE NULL
                    END as description,
                    parent_transaction_id
                    FROM transactions
                    WHERE account_id IN ({placeholders})
                    AND user_id = :user_id
                    AND transaction_date >= :month_start
                    AND transaction_date <= :month_end
                """
            
            try:
                month_result = db.execute(sa_text(month_sql), month_params)
                month_transactions_data = month_result.fetchall()
            except Exception as e:
                error_str = str(e)
                if "CharacterNotInRepertoire" in error_str or "invalid byte sequence" in error_str:
                    logger.error(f"Encoding error in monthly comparison query: {e}")
                    # Try simpler query
                    try:
                        if shared_account_ids_list:
                            simple_month_sql = f"""
                                SELECT transaction_type::text, amount, description, parent_transaction_id
                                FROM transactions
                                WHERE ({where_clause})
                                AND transaction_date >= :month_start
                                AND transaction_date <= :month_end
                            """
                        else:
                            simple_month_sql = f"""
                                SELECT transaction_type::text, amount, description, parent_transaction_id
                                FROM transactions
                                WHERE account_id IN ({placeholders})
                                AND user_id = :user_id
                                AND transaction_date >= :month_start
                                AND transaction_date <= :month_end
                            """
                        month_result = db.execute(sa_text(simple_month_sql), month_params)
                        month_transactions_data = month_result.fetchall()
                    except Exception as e2:
                        logger.error(f"Fallback monthly query also failed: {e2}")
                        month_transactions_data = []
                else:
                    logger.error(f"Error in monthly comparison query: {e}")
                    month_transactions_data = []
        
        month_income = 0.0
        month_expense = 0.0
        for row in month_transactions_data:
            trans_type = row[0].lower() if row[0] else ''
            amount = float(row[1]) if row[1] else 0.0
            description = safe_decode(row[2]) if len(row) > 2 else None
            parent_transaction_id = row[3] if len(row) > 3 else None
            
            # Exclude transfer income transactions
            is_transfer_income = False
            if parent_transaction_id is not None:
                is_transfer_income = True
            elif description:
                description_lower = description.strip().lower()
                if description_lower.startswith('перевод из'):
                    is_transfer_income = True
            
            if trans_type == 'income' and not is_transfer_income:
                month_income += amount
            elif trans_type == 'expense':
                month_expense += amount
        
        monthly_data.append({
            "month": f"{format_month_russian(month_start)} {month_start.year}",
            "month_short": format_month_russian(month_start, short=True),
            "income": month_income,
            "expense": month_expense,
            "net": month_income - month_expense
        })
    
    monthly_data.reverse()  # Oldest first
    
    # Generate interesting facts
    facts = []
    
    if total_expense > 0:
        # Calculate number of days in the period
        # For week: 7 days (from start_date to end_date inclusive)
        # For month: days from 1st of month to today (inclusive)
        # For year: days from January 1st to today (inclusive)
        if period == "week":
            # Calculate days from start_date to end_date (inclusive)
            days_in_period = (end_date.date() - start_date.date()).days + 1
        elif period == "month":
            # Days from 1st of current month to today (inclusive)
            days_in_period = end_date.day
        elif period == "year":
            # Days from January 1st to today (inclusive)
            # Calculate day of year
            days_in_period = (end_date.date() - datetime(end_date.year, 1, 1).date()).days + 1
        else:
            # Default to month calculation
            days_in_period = end_date.day
        
        avg_daily_expense = total_expense / max(days_in_period, 1)
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
    
    result = {
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
    
    logger.info(f"[Analytics] Returning result: income={result['totals']['income']}, expense={result['totals']['expense']}, net={result['totals']['net']}, period={period}")
    
    return result


@router.get("/premium/export")
async def generate_premium_report(
    format: str = "pdf",  # "pdf" or "excel"
    period: Optional[str] = "month",  # "week", "month", "year"
    start_date: Optional[str] = None,  # ISO format date string
    end_date: Optional[str] = None,  # ISO format date string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate premium financial report in PDF or Excel format.
    Requires premium subscription.
    """
    # Check premium status
    require_premium(current_user, db)
    
    # Validate format
    if format not in ["pdf", "excel"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Формат должен быть 'pdf' или 'excel'"
        )
    
    # Parse dates or use period
    if start_date and end_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат даты. Используйте ISO формат (YYYY-MM-DD или YYYY-MM-DDTHH:MM:SS)"
            )
    else:
        # Use period
        end_dt = datetime.utcnow()
        if period == "week":
            start_dt = end_dt - timedelta(days=7)
        elif period == "month":
            start_dt = end_dt - timedelta(days=30)
        elif period == "year":
            start_dt = end_dt - timedelta(days=365)
        else:
            start_dt = end_dt - timedelta(days=30)
    
    # Get analytics data - call get_analytics with appropriate period
    # Determine period from dates if custom dates provided
    if start_date and end_date:
        # Calculate period based on date range
        days_diff = (end_dt - start_dt).days
        if days_diff <= 7:
            period_for_analytics = "week"
        elif days_diff <= 90:
            period_for_analytics = "month"
        else:
            period_for_analytics = "year"
    else:
        period_for_analytics = period
    
    # Get analytics data
    analytics_response = await get_analytics(
        period=period_for_analytics,
        current_user=current_user,
        db=db
    )
    
    # Override dates if custom dates provided
    if start_date and end_date:
        analytics_response["start_date"] = start_dt.isoformat()
        analytics_response["end_date"] = end_dt.isoformat()
        # Recalculate analytics for custom date range
        # We'll use the same logic but with custom dates
        from app.models.shared_budget import SharedBudgetMember
        
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
    else:
        # Use account IDs from analytics response calculation
        from app.models.shared_budget import SharedBudgetMember
        user_accounts = db.query(Account).filter(
            Account.user_id == current_user.id,
            Account.is_active == True
        ).all()
        account_ids = [acc.id for acc in user_accounts]
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
        start_dt = datetime.fromisoformat(analytics_response["start_date"].replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(analytics_response["end_date"].replace('Z', '+00:00'))
    
    # Get transactions with full details for report
    transactions_list = []
    if all_account_ids:
        placeholders = ','.join([f':acc_{i}' for i in range(len(all_account_ids))])
        params = {f"acc_{i}": acc_id for i, acc_id in enumerate(all_account_ids)}
        params["start_date"] = start_dt
        params["end_date"] = end_dt
        
        # Get transactions with category and account names
        sql_query = f"""
            SELECT 
                t.id, t.account_id, t.transaction_type::text, t.amount, t.currency,
                t.category_id, t.description, t.goal_id, t.transaction_date,
                t.amount_in_default_currency,
                c.name as category_name, a.name as account_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE t.account_id IN ({placeholders})
            AND t.transaction_date >= :start_date
            AND t.transaction_date <= :end_date
            ORDER BY t.transaction_date DESC
        """
        
        result = db.execute(sa_text(sql_query), params)
        for row in result:
            transactions_list.append({
                "id": row[0],
                "account_id": row[1],
                "transaction_type": row[2].lower() if row[2] else '',
                "amount": float(row[3]) if row[3] else 0.0,
                "currency": row[4] or current_user.default_currency,
                "category_id": row[5],
                "description": row[6] or '',
                "goal_id": row[7],
                "transaction_date": row[8].isoformat() if row[8] else '',
                "amount_in_default_currency": float(row[9]) if row[9] else None,
                "category_name": row[10] or '',
                "account_name": row[11] or ''
            })
    
    # Prepare user info
    user_info = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "username": current_user.username,
        "email": current_user.email,
        "default_currency": current_user.default_currency
    }
    
    # Generate report
    generator = PremiumReportGenerator(
        user_data={},
        analytics_data=analytics_response,
        transactions_data=transactions_list,
        user_info=user_info
    )
    
    if format == "pdf":
        pdf_bytes = generator.generate_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="financial_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
            }
        )
    else:  # excel
        excel_bytes = generator.generate_excel()
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="financial_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
            }
        )


@router.post("/premium/send-via-bot")
async def send_report_via_bot(
    format: str = "pdf",  # "pdf" or "excel"
    period: Optional[str] = "month",  # "week", "month", "year"
    start_date: Optional[str] = None,  # ISO format date string
    end_date: Optional[str] = None,  # ISO format date string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate premium report and send it via Telegram or VK bot.
    Requires premium subscription.
    """
    import httpx
    from app.core.config import settings
    
    try:
        # Check premium status
        require_premium(current_user)
        
        # Validate format
        if format not in ["pdf", "excel"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Формат должен быть 'pdf' или 'excel'"
            )
        
        # Parse dates or use period
        if start_date and end_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат даты. Используйте ISO формат (YYYY-MM-DD или YYYY-MM-DDTHH:MM:SS)"
                )
        else:
            # Use period
            end_dt = datetime.utcnow()
            if period == "week":
                start_dt = end_dt - timedelta(days=7)
            elif period == "month":
                start_dt = end_dt - timedelta(days=30)
            elif period == "year":
                start_dt = end_dt - timedelta(days=365)
            else:
                start_dt = end_dt - timedelta(days=30)
        
        # Determine period for analytics
        if start_date and end_date:
            days_diff = (end_dt - start_dt).days
            if days_diff <= 7:
                period_for_analytics = "week"
            elif days_diff <= 90:
                period_for_analytics = "month"
            else:
                period_for_analytics = "year"
        else:
            period_for_analytics = period
        
        # Get analytics data
        analytics_response = await get_analytics(
            period=period_for_analytics,
            current_user=current_user,
            db=db
        )
        
        # Override dates if custom dates provided
        if start_date and end_date:
            analytics_response["start_date"] = start_dt.isoformat()
            analytics_response["end_date"] = end_dt.isoformat()
            from app.models.shared_budget import SharedBudgetMember
            user_accounts = db.query(Account).filter(
                Account.user_id == current_user.id,
                Account.is_active == True
            ).all()
            account_ids = [acc.id for acc in user_accounts]
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
        else:
            from app.models.shared_budget import SharedBudgetMember
            user_accounts = db.query(Account).filter(
                Account.user_id == current_user.id,
                Account.is_active == True
            ).all()
            account_ids = [acc.id for acc in user_accounts]
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
            start_dt = datetime.fromisoformat(analytics_response["start_date"].replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(analytics_response["end_date"].replace('Z', '+00:00'))
        
        # Get transactions
        transactions_list = []
        if all_account_ids:
            placeholders = ','.join([f':acc_{i}' for i in range(len(all_account_ids))])
            params = {f"acc_{i}": acc_id for i, acc_id in enumerate(all_account_ids)}
            params["start_date"] = start_dt
            params["end_date"] = end_dt
            
            sql_query = f"""
                SELECT 
                    t.id, t.account_id, t.transaction_type::text, t.amount, t.currency,
                    t.category_id, t.description, t.goal_id, t.transaction_date,
                    t.amount_in_default_currency,
                    c.name as category_name, a.name as account_name
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                WHERE t.account_id IN ({placeholders})
                AND t.transaction_date >= :start_date
                AND t.transaction_date <= :end_date
                ORDER BY t.transaction_date DESC
            """
            
            result = db.execute(sa_text(sql_query), params)
            for row in result:
                transactions_list.append({
                    "id": row[0],
                    "account_id": row[1],
                    "transaction_type": row[2].lower() if row[2] else '',
                    "amount": float(row[3]) if row[3] else 0.0,
                    "currency": row[4] or current_user.default_currency,
                    "category_id": row[5],
                    "description": row[6] or '',
                    "goal_id": row[7],
                    "transaction_date": row[8].isoformat() if row[8] else '',
                    "amount_in_default_currency": float(row[9]) if row[9] else None,
                    "category_name": row[10] or '',
                    "account_name": row[11] or ''
                })
        
        # Prepare user info
        user_info = {
            "id": current_user.id,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "username": current_user.username,
            "email": current_user.email,
            "default_currency": current_user.default_currency
        }
        
        # Generate report
        generator = PremiumReportGenerator(
            user_data={},
            analytics_data=analytics_response,
            transactions_data=transactions_list,
            user_info=user_info
        )
        
        # Generate file
        if format == "pdf":
            file_bytes = generator.generate_pdf()
            file_extension = "pdf"
            mime_type = "application/pdf"
        else:
            file_bytes = generator.generate_excel()
            file_extension = "xlsx"
            mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
        filename = f"financial_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_extension}"
        
        # Send via bot (Telegram or VK)
        telegram_id = current_user.telegram_id
        vk_id = current_user.vk_id
        
        if telegram_id:
            # Send via Telegram bot
            try:
                import base64
                file_base64 = base64.b64encode(file_bytes).decode('utf-8')
                
                url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendDocument"
                files = {
                    'document': (filename, file_bytes, mime_type)
                }
                data = {
                    'chat_id': telegram_id,
                    'caption': f'📊 Ваш финансовый отчет за период {start_dt.strftime("%d.%m.%Y")} - {end_dt.strftime("%d.%m.%Y")}'
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, files=files, data=data)
                    if response.status_code == 200:
                        return {"status": "success", "message": "Отчет отправлен в Telegram", "platform": "telegram"}
                    else:
                        logger.error(f"Failed to send Telegram document: {response.status_code}, {response.text}")
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Не удалось отправить отчет в Telegram"
                        )
            except Exception as e:
                logger.error(f"Error sending Telegram document: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка отправки отчета: {str(e)}"
                )
        
        elif vk_id:
            # Send via VK bot
            try:
                import base64
                file_base64 = base64.b64encode(file_bytes).decode('utf-8')
                
                # VK API для отправки документов
                # Нужно сначала загрузить документ на сервер VK, затем отправить
                # Для упрощения, отправляем через backend VK бота
                # В реальности нужно использовать VK API для загрузки документов
                
                # Пока возвращаем ошибку, т.к. VK API требует более сложной логики
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail="Отправка через VK бота временно недоступна. Используйте Telegram или скачайте отчет напрямую."
                )
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error sending VK document: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка отправки отчета: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не найден Telegram ID или VK ID. Пожалуйста, войдите через Telegram или VK."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in send_report_via_bot: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации или отправке отчета: {str(e)}"
        )

