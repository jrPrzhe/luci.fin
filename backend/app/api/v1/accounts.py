from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text as sa_text
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class AccountCreate(BaseModel):
    name: str
    account_type: str = "cash"  # cash, bank_card, bank_account, etc.
    currency: str = "RUB"
    initial_balance: float = 0.0
    description: Optional[str] = None
    shared_budget_id: Optional[int] = None  # If provided, account belongs to shared budget


@router.get("/", response_model=List[dict])
async def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all accounts for current user (including shared accounts from budgets)"""
    # Get user's own accounts
    accounts = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.is_archived == False,
        Account.shared_budget_id == None  # Personal accounts only
    ).all()
    
    # Get shared accounts from budgets where user is a member
    from app.models.shared_budget import SharedBudgetMember
    budget_memberships = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.user_id == current_user.id
    ).all()
    budget_ids = [m.shared_budget_id for m in budget_memberships]
    
    shared_accounts = []
    if budget_ids:
        shared_accounts = db.query(Account).filter(
            Account.shared_budget_id.in_(budget_ids),
            Account.is_archived == False
        ).all()
    
    # Combine personal and shared accounts
    all_accounts = list(accounts) + list(shared_accounts)
    
    result = []
    for account in all_accounts:
        try:
            # Calculate current balance
            # For shared accounts, count ALL transactions (from all members)
            # For personal accounts, count only user's transactions
            # Use raw SQL to avoid enum conversion issues
            if account.shared_budget_id:
                # Shared account: count all transactions
                transactions_result = db.execute(
                    sa_text("""
                        SELECT transaction_type::text, amount 
                        FROM transactions 
                        WHERE account_id = :account_id
                    """),
                    {"account_id": account.id}
                )
            else:
                # Personal account: count only user's transactions
                transactions_result = db.execute(
                    sa_text("""
                        SELECT transaction_type::text, amount 
                        FROM transactions 
                        WHERE account_id = :account_id AND user_id = :user_id
                    """),
                    {"account_id": account.id, "user_id": current_user.id}
                )
            
            balance = Decimal(str(account.initial_balance)) if account.initial_balance else Decimal("0")
            for row in transactions_result:
                trans_type = row[0].lower()  # Convert to lowercase for comparison
                amount = Decimal(str(row[1])) if row[1] else Decimal("0")
                
                if trans_type == 'income':
                    balance += amount
                elif trans_type == 'expense':
                    balance -= amount
                elif trans_type == 'transfer':
                    # Transfer уменьшает баланс счета отправления
                    balance -= amount
            
            # Get shared budget name if applicable
            shared_budget_name = None
            if account.shared_budget_id:
                from app.models.shared_budget import SharedBudget
                shared_budget = db.query(SharedBudget).filter(SharedBudget.id == account.shared_budget_id).first()
                shared_budget_name = shared_budget.name if shared_budget else None
            
            result.append({
                "id": account.id,
                "name": account.name,
                "type": account.account_type.value if account.account_type else "cash",
                "currency": account.currency or "USD",
                "balance": float(balance),
                "initial_balance": float(account.initial_balance) if account.initial_balance else 0.0,
                "is_active": account.is_active if account.is_active is not None else True,
                "description": account.description,
                "created_at": account.created_at.isoformat() if account.created_at else None,
                "shared_budget_id": account.shared_budget_id,
                "shared_budget_name": shared_budget_name,
                "is_shared": account.shared_budget_id is not None
            })
        except Exception as e:
            logger.error(f"Error serializing account {account.id}: {e}", exc_info=True)
            # Skip this account if there's an error
            continue
    
    return result


@router.get("/balance", response_model=dict)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total balance across all accounts"""
    accounts = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.is_archived == False
    ).all()
    
    total_balance = Decimal("0")
    account_balances = []
    
    for account in accounts:
        try:
            # Calculate balance - filter transactions by both account and user for security
            # Use raw SQL to avoid enum conversion issues
            transactions_result = db.execute(
                sa_text("""
                    SELECT transaction_type::text, amount 
                    FROM transactions 
                    WHERE account_id = :account_id AND user_id = :user_id
                """),
                {"account_id": account.id, "user_id": current_user.id}
            )
            
            balance = Decimal(str(account.initial_balance)) if account.initial_balance else Decimal("0")
            for row in transactions_result:
                trans_type = row[0].lower()  # Convert to lowercase for comparison
                amount = Decimal(str(row[1])) if row[1] else Decimal("0")
                
                if trans_type == 'income':
                    balance += amount
                elif trans_type == 'expense':
                    balance -= amount
                elif trans_type == 'transfer':
                    # Transfer уменьшает баланс счета отправления
                    balance -= amount
            
            # For simplicity, assume same currency for now
            total_balance += balance
            account_balances.append({
                "id": account.id,
                "name": account.name,
                "balance": float(balance),
                "currency": account.currency or "USD"
            })
        except Exception as e:
            logger.error(f"Error calculating balance for account {account.id}: {e}", exc_info=True)
            # Skip this account if there's an error
            continue
    
    return {
        "total": float(total_balance),
        "currency": current_user.default_currency or "USD",
        "accounts": account_balances
    }


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new account for current user or shared budget"""
    # Validate account type
    try:
        account_type = AccountType(account_data.account_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверный тип счета. Должен быть одним из: {[e.value for e in AccountType]}"
        )
    
    # If shared_budget_id is provided, verify user is a member
    shared_budget_id = account_data.shared_budget_id
    if shared_budget_id:
        from app.models.shared_budget import SharedBudget, SharedBudgetMember, MemberRole
        # Check if budget exists
        budget = db.query(SharedBudget).filter(SharedBudget.id == shared_budget_id).first()
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Общий бюджет не найден"
            )
        
        # Check if user is a member (admin can create accounts)
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет доступа к этому общему бюджету"
            )
        
        # Only admins can create shared accounts
        if membership.role != MemberRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы могут создавать общие счета"
            )
    
    # Create account
    account = Account(
        user_id=current_user.id,  # Creator
        shared_budget_id=shared_budget_id,  # Can be None for personal accounts
        name=account_data.name,
        account_type=account_type,
        currency=account_data.currency or current_user.default_currency,
        initial_balance=Decimal(str(account_data.initial_balance)),
        description=account_data.description,
        is_active=True
    )
    
    db.add(account)
    db.commit()
    db.refresh(account)
    
    # Get shared budget name if applicable
    shared_budget_name = None
    if account.shared_budget_id:
        from app.models.shared_budget import SharedBudget
        shared_budget = db.query(SharedBudget).filter(SharedBudget.id == account.shared_budget_id).first()
        shared_budget_name = shared_budget.name if shared_budget else None
    
    return {
        "id": account.id,
        "name": account.name,
        "type": account.account_type.value,
        "currency": account.currency,
        "balance": float(account.initial_balance),
        "initial_balance": float(account.initial_balance),
        "is_active": account.is_active,
        "description": account.description,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "shared_budget_id": account.shared_budget_id,
        "shared_budget_name": shared_budget_name,
        "is_shared": account.shared_budget_id is not None
    }


@router.delete("/{account_id}", response_model=dict)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an account"""
    # Verify account belongs to user or user has access through shared budget
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Счет не найден"
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
            detail="У вас нет доступа к этому счету"
        )
    
    # For shared accounts, only admins can delete
    if account.shared_budget_id:
        from app.models.shared_budget import SharedBudgetMember, MemberRole
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == account.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id,
            SharedBudgetMember.role == MemberRole.ADMIN
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы могут удалять общие счета"
            )
    
    # Check if account has transactions
    transaction_count = db.query(Transaction).filter(
        Transaction.account_id == account_id
    ).count()
    
    if transaction_count > 0:
        # Archive instead of delete
        account.is_archived = True
        account.is_active = False
        db.commit()
        db.refresh(account)
        return {"message": "Account archived (has transactions)", "account_id": account_id}
    else:
        # Delete if no transactions
        db.delete(account)
        db.commit()
        return {"message": "Account deleted", "account_id": account_id}

