from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text as sa_text
from typing import List, Optional
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.account import Account, AccountType
from app.models.transaction import Transaction, TransactionType
from app.schemas.account import AccountCreate, AccountUpdate
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


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
    
    # Validate description length (Pydantic should handle this, but double-check)
    if account_data.description and len(account_data.description) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Описание не может превышать 500 символов"
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


@router.put("/{account_id}", response_model=dict)
async def update_account(
    account_id: int,
    account_update: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an account"""
    # Verify account belongs to user or user has access through shared budget
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Счет не найден"
        )
    
    # Check access: either owner or admin member of shared budget
    has_access = False
    is_admin = False
    if account.user_id == current_user.id:
        has_access = True
        is_admin = True  # Owner is admin
    elif account.shared_budget_id:
        from app.models.shared_budget import SharedBudgetMember, MemberRole
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == account.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        if membership:
            has_access = True
            is_admin = membership.role == MemberRole.ADMIN
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этому счету"
        )
    
    # For shared accounts, only admins can update
    if account.shared_budget_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут редактировать общие счета"
        )
    
    # Validate description length
    if account_update.description is not None and len(account_update.description) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Описание не может превышать 500 символов"
        )
    
    # Update fields
    if account_update.name is not None:
        account.name = account_update.name
    if account_update.account_type is not None:
        try:
            account.account_type = AccountType(account_update.account_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Неверный тип счета. Должен быть одним из: {[e.value for e in AccountType]}"
            )
    if account_update.currency is not None:
        account.currency = account_update.currency
    if account_update.description is not None:
        account.description = account_update.description
    if account_update.is_active is not None:
        account.is_active = account_update.is_active
    
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
        "balance": float(account.initial_balance),  # Will be recalculated on next fetch
        "initial_balance": float(account.initial_balance),
        "is_active": account.is_active,
        "description": account.description,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "shared_budget_id": account.shared_budget_id,
        "shared_budget_name": shared_budget_name,
        "is_shared": account.shared_budget_id is not None
    }


@router.get("/{account_id}/transaction-count", response_model=dict)
async def get_account_transaction_count(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of transactions for an account"""
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
    
    # Count transactions where account is source
    source_count = db.query(Transaction).filter(
        Transaction.account_id == account_id
    ).count()
    
    # Count transactions where account is destination (transfers)
    dest_count = db.query(Transaction).filter(
        Transaction.to_account_id == account_id
    ).count()
    
    total_count = source_count + dest_count
    
    return {
        "account_id": account_id,
        "transaction_count": total_count,
        "source_transactions": source_count,
        "destination_transactions": dest_count
    }


@router.delete("/{account_id}", response_model=dict)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an account and all related transactions"""
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
    
    # Check if account is linked to a goal
    from app.models.goal import Goal
    linked_goal = db.query(Goal).filter(Goal.account_id == account_id).first()
    
    if linked_goal:
        # If account is linked to a goal, we need to handle the goal first
        # Option 1: Delete the goal (which will handle the account relationship)
        # Option 2: Unlink the goal from the account
        
        # Check if account has transactions
        transaction_count = db.query(Transaction).filter(
            Transaction.account_id == account_id
        ).count()
        
        if transaction_count > 0:
            # Archive account and unlink goal
            account.is_archived = True
            account.is_active = False
            linked_goal.account_id = None  # Unlink goal from account
            db.commit()
            db.refresh(account)
            return {
                "message": "Account archived (has transactions and was linked to a goal)", 
                "account_id": account_id,
                "goal_unlinked": True,
                "goal_id": linked_goal.id
            }
        else:
            # Delete the goal first (which will handle account deletion)
            # But we need to delete the account ourselves since delete_goal handles it differently
            # Actually, let's just unlink and delete the account
            linked_goal.account_id = None
            db.delete(account)
            db.commit()
            return {
                "message": "Account deleted (was linked to a goal, goal unlinked)", 
                "account_id": account_id,
                "goal_unlinked": True,
                "goal_id": linked_goal.id
            }
    
    # Check if account has transactions
    from app.models.transaction import Transaction
    transactions = db.query(Transaction).filter(
        Transaction.account_id == account_id
    ).all()
    
    transaction_count = len(transactions)
    
    # Also check for transfer transactions where this account is the destination
    transfer_transactions = db.query(Transaction).filter(
        Transaction.to_account_id == account_id
    ).all()
    
    all_transactions = transactions + transfer_transactions
    total_transaction_count = len(all_transactions)
    
    if total_transaction_count > 0:
        # Delete all transactions related to this account
        # Delete transactions where account is source
        for transaction in transactions:
            # If it's a transfer, also delete the corresponding destination transaction
            if transaction.transaction_type == 'transfer' and transaction.to_account_id:
                dest_transaction = db.query(Transaction).filter(
                    Transaction.account_id == transaction.to_account_id,
                    Transaction.transaction_type == 'income',
                    Transaction.amount == transaction.amount,
                    Transaction.transaction_date == transaction.transaction_date
                ).first()
                if dest_transaction:
                    db.delete(dest_transaction)
            db.delete(transaction)
        
        # Delete transactions where account is destination (transfer income transactions)
        for transaction in transfer_transactions:
            db.delete(transaction)
        
        # Now delete the account
        db.delete(account)
        db.commit()
        return {
            "message": "Account and all related transactions deleted", 
            "account_id": account_id,
            "transactions_deleted": total_transaction_count
        }
    else:
        # Delete if no transactions
        db.delete(account)
        db.commit()
        return {"message": "Account deleted", "account_id": account_id}

