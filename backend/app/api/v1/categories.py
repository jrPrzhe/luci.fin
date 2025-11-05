from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.category import Category, TransactionType
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse, CategorySetFavorite

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
async def get_categories(
    transaction_type: Optional[TransactionType] = None,
    favorites_only: Optional[bool] = False,
    shared_budget_id: Optional[int] = None,  # Get categories for shared budget
    include_shared: Optional[bool] = True,  # Include shared budget categories
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's categories and optionally shared budget categories"""
    from sqlalchemy import or_
    from app.models.shared_budget import SharedBudgetMember
    
    # Base query for user's own categories
    user_categories_query = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.shared_budget_id.is_(None)  # Only personal categories
    )
    
    # If filtering by specific shared budget
    if shared_budget_id:
        # Check if user is member of this budget
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this shared budget"
            )
        
        # Get categories for this shared budget (from all members)
        budget_members = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == shared_budget_id
        ).all()
        member_user_ids = [m.user_id for m in budget_members]
        
        query = db.query(Category).filter(
            Category.shared_budget_id == shared_budget_id,
            Category.user_id.in_(member_user_ids)
        )
    elif include_shared:
        # Get user's categories + categories from shared budgets user is member of
        budget_memberships = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.user_id == current_user.id
        ).all()
        budget_ids = [m.shared_budget_id for m in budget_memberships]
        
        if budget_ids:
            # Combine user's personal categories with shared budget categories
            query = db.query(Category).filter(
                or_(
                    # User's personal categories
                    (Category.user_id == current_user.id) & (Category.shared_budget_id.is_(None)),
                    # Shared budget categories
                    Category.shared_budget_id.in_(budget_ids)
                )
            )
        else:
            # No shared budgets, only personal categories
            query = user_categories_query
    else:
        # Only personal categories
        query = user_categories_query
    
    if transaction_type:
        query = query.filter(
            (Category.transaction_type == transaction_type) | 
            (Category.transaction_type == TransactionType.BOTH)
        )
    
    if favorites_only:
        query = query.filter(Category.is_favorite == True)
    
    categories = query.filter(Category.is_active == True).order_by(
        Category.shared_budget_id.is_(None).desc(),  # Personal categories first
        Category.is_favorite.desc(),
        Category.is_system.desc(),
        Category.name
    ).all()
    
    return categories


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific category"""
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    return category


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new category"""
    # Check if shared_budget_id is provided and user is member
    shared_budget_id = None
    if category.shared_budget_id:
        from app.models.shared_budget import SharedBudgetMember
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == category.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this shared budget"
            )
        shared_budget_id = category.shared_budget_id
    
    # Check if parent category exists and belongs to user/shared budget
    if category.parent_id:
        parent = db.query(Category).filter(
            Category.id == category.parent_id
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found"
            )
        # Check access to parent category
        if parent.shared_budget_id != shared_budget_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent category must belong to the same shared budget"
            )
    
    # Check if category name already exists for this user/shared budget
    existing_query = db.query(Category).filter(
        Category.name == category.name,
        Category.is_active == True
    )
    if shared_budget_id:
        existing_query = existing_query.filter(Category.shared_budget_id == shared_budget_id)
    else:
        existing_query = existing_query.filter(
            Category.user_id == current_user.id,
            Category.shared_budget_id.is_(None)
        )
    
    existing = existing_query.first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )
    
    db_category = Category(
        user_id=current_user.id,
        shared_budget_id=shared_budget_id,
        name=category.name,
        transaction_type=category.transaction_type,
        icon=category.icon,
        color=category.color,
        parent_id=category.parent_id,
        budget_limit=category.budget_limit,
        is_favorite=category.is_favorite or False,
        is_system=False,
        is_active=True
    )
    
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return db_category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_update: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a category"""
    from app.models.shared_budget import SharedBudgetMember
    
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_system == False  # Can't edit system categories
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or cannot be edited"
        )
    
    # Check access: must be owner or member of shared budget
    if category.shared_budget_id:
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == category.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit this category"
            )
    elif category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this category"
        )
    
    # Check if new name conflicts with existing category
    if category_update.name and category_update.name != category.name:
        existing_query = db.query(Category).filter(
            Category.name == category_update.name,
            Category.id != category_id,
            Category.is_active == True
        )
        if category.shared_budget_id:
            existing_query = existing_query.filter(Category.shared_budget_id == category.shared_budget_id)
        else:
            existing_query = existing_query.filter(
                Category.user_id == current_user.id,
                Category.shared_budget_id.is_(None)
            )
        
        existing = existing_query.first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this name already exists"
            )
    
    # Update fields
    update_data = category_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a category"""
    from app.models.shared_budget import SharedBudgetMember
    
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_system == False  # Can't delete system categories
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or cannot be deleted"
        )
    
    # Check access: must be owner or member of shared budget
    if category.shared_budget_id:
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == category.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this category"
            )
    elif category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this category"
        )
    
    # Check if category is used in transactions
    from app.models.transaction import Transaction
    transaction_count = db.query(Transaction).filter(
        Transaction.category_id == category_id
    ).count()
    
    if transaction_count > 0:
        # Soft delete - deactivate instead of deleting
        category.is_active = False
        db.commit()
    else:
        # Hard delete if not used
        db.delete(category)
        db.commit()
    
    return None


@router.patch("/{category_id}/favorite", response_model=CategoryResponse)
async def toggle_favorite(
    category_id: int,
    favorite: CategorySetFavorite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle favorite status of a category"""
    from app.models.shared_budget import SharedBudgetMember
    
    category = db.query(Category).filter(Category.id == category_id).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    # Check access: personal category or shared budget member
    if category.shared_budget_id:
        membership = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == category.shared_budget_id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this category"
            )
    elif category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this category"
        )
    
    category.is_favorite = favorite.is_favorite
    db.commit()
    db.refresh(category)
    
    return category

