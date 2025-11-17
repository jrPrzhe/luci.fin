from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text as sa_text
from typing import List, Optional
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.category import Category, TransactionType
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse, CategorySetFavorite

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
async def get_categories(
    transaction_type: Optional[str] = None,  # Accept string instead of enum to avoid parsing issues
    favorites_only: Optional[bool] = False,
    shared_budget_id: Optional[int] = None,  # Get categories for shared budget
    include_shared: Optional[bool] = True,  # Include shared budget categories
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's categories and optionally shared budget categories"""
    import logging
    logger = logging.getLogger(__name__)
    
    from app.models.shared_budget import SharedBudgetMember
    
    # Use raw SQL to avoid enum comparison issues
    # Build SQL query
    sql_query = """
        SELECT 
            id, user_id, shared_budget_id, name, transaction_type::text, parent_id,
            icon, color, is_system, is_active, is_favorite, budget_limit,
            created_at, updated_at
        FROM categories
        WHERE 1=1
    """
    
    params = {}
    
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
        
        placeholders = ','.join([f':member_{i}' for i in range(len(member_user_ids))])
        sql_query += f" AND shared_budget_id = :shared_budget_id AND user_id IN ({placeholders})"
        params["shared_budget_id"] = shared_budget_id
        for i, user_id in enumerate(member_user_ids):
            params[f"member_{i}"] = user_id
    elif include_shared:
        # Get user's categories + categories from shared budgets user is member of
        budget_memberships = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.user_id == current_user.id
        ).all()
        budget_ids = [m.shared_budget_id for m in budget_memberships]
        
        if budget_ids:
            # Combine user's personal categories with shared budget categories
            placeholders = ','.join([f':budget_{i}' for i in range(len(budget_ids))])
            sql_query += f" AND ((user_id = :user_id AND shared_budget_id IS NULL) OR shared_budget_id IN ({placeholders}))"
            params["user_id"] = current_user.id
            for i, budget_id in enumerate(budget_ids):
                params[f"budget_{i}"] = budget_id
        else:
            # No shared budgets, only personal categories
            sql_query += " AND user_id = :user_id AND shared_budget_id IS NULL"
            params["user_id"] = current_user.id
    else:
        # Only personal categories
        sql_query += " AND user_id = :user_id AND shared_budget_id IS NULL"
        params["user_id"] = current_user.id
    
    if transaction_type:
        # Convert string to lowercase for comparison
        transaction_type_lower = transaction_type.lower()
        try:
            # Validate transaction type
            TransactionType(transaction_type_lower)
            # Use raw SQL text comparison to avoid enum issues
            sql_query += " AND (LOWER(transaction_type::text) = :transaction_type OR LOWER(transaction_type::text) = 'both')"
            params["transaction_type"] = transaction_type_lower
        except ValueError:
            # If invalid transaction type, return empty list
            return []
    
    if favorites_only:
        sql_query += " AND is_favorite = true"
    
    sql_query += " AND is_active = true"
    sql_query += " ORDER BY shared_budget_id IS NULL DESC, is_favorite DESC, is_system DESC, name"
    
    try:
        # Execute raw SQL query
        result_rows = db.execute(sa_text(sql_query), params).fetchall()
        
        # Build response from raw SQL results
        categories = []
        for row in result_rows:
            try:
                cat_dict = {
                    "id": row[0],
                    "user_id": row[1],
                    "shared_budget_id": row[2],
                    "name": row[3],
                    "transaction_type": TransactionType(row[4].lower()) if row[4] else TransactionType.BOTH,  # Convert to enum
                    "parent_id": row[5],
                    "icon": row[6],
                    "color": row[7],
                    "is_system": row[8],
                    "is_active": row[9],
                    "is_favorite": row[10],
                    "budget_limit": float(row[11]) if row[11] else None,
                    "created_at": row[12],
                    "updated_at": row[13],
                }
                categories.append(CategoryResponse(**cat_dict))
            except Exception as e:
                logger.error(f"Error serializing category {row[0] if row else 'unknown'}: {e}", exc_info=True)
                continue
        
        return categories
    except Exception as e:
        logger.error(f"Error fetching categories: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching categories: {str(e)}"
        )


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
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Check if shared_budget_id is provided and user is member
        shared_budget_id = None
        if category.shared_budget_id:
            try:
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
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error checking shared budget membership: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error checking shared budget access"
                )
        
        # Check if parent category exists and belongs to user/shared budget
        if category.parent_id:
            try:
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
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error checking parent category: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error checking parent category"
                )
        
        # Check if category name already exists for this user/shared budget
        try:
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
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error checking existing category: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error checking category name"
            )
        
        # Create category
        try:
            # Ensure transaction_type is properly converted to lowercase string
            # Extract from Pydantic model and convert to lowercase string
            transaction_type_raw = category.transaction_type
            
            # Log for debugging
            logger.info(f"Raw transaction_type: {transaction_type_raw}, type: {type(transaction_type_raw)}")
            
            # Convert to lowercase string - IMPORTANT: always pass string to SQLAlchemy model
            if isinstance(transaction_type_raw, TransactionType):
                # Get the lowercase value from enum (e.g., TransactionType.EXPENSE.value = "expense")
                transaction_type_value = transaction_type_raw.value
                logger.info(f"Converted enum {transaction_type_raw} to value: {transaction_type_value}")
            elif isinstance(transaction_type_raw, str):
                # Convert string to lowercase
                transaction_type_value = transaction_type_raw.lower()
                logger.info(f"Converted string '{transaction_type_raw}' to lowercase: {transaction_type_value}")
            else:
                # Fallback: convert to string and then to lowercase
                transaction_type_value = str(transaction_type_raw).lower()
                logger.info(f"Converted {type(transaction_type_raw)} '{transaction_type_raw}' to lowercase: {transaction_type_value}")
            
            # Log the final value
            logger.info(f"Final transaction_type_value: {transaction_type_value}, type: {type(transaction_type_value)}")
            
            # Validate the value is one of the allowed values
            if transaction_type_value not in ['income', 'expense', 'both']:
                raise ValueError(f"Invalid transaction_type: {transaction_type_value}. Must be one of: income, expense, both")
            
            # Create category with lowercase string for transaction_type
            db_category = Category(
                user_id=current_user.id,
                shared_budget_id=shared_budget_id,
                name=category.name,
                transaction_type=transaction_type_value,  # Pass lowercase string directly
                icon=category.icon,
                color=category.color,
                parent_id=category.parent_id,
                budget_limit=category.budget_limit,
                is_favorite=category.is_favorite or False,
                is_system=False,
                is_active=True
            )
            
            # CRITICAL FIX: Force transaction_type to be lowercase string
            # SQLAlchemy's TypeDecorator should handle this, but we ensure it's correct
            # Set directly in __dict__ to bypass any property setters or conversions
            db_category.__dict__['transaction_type'] = transaction_type_value
            
            # Verify it's set correctly
            logger.info(f"Set transaction_type in __dict__: {db_category.__dict__.get('transaction_type')}")
            
            # Also set via attribute to trigger TypeDecorator if needed
            # But ensure it's a string, not enum
            if isinstance(transaction_type_value, str):
                # Direct assignment - TypeDecorator.process_bind_param will be called
                db_category.transaction_type = transaction_type_value
            else:
                # Convert to string first
                db_category.transaction_type = str(transaction_type_value).lower()
            
            # Final verification - check what will be sent to DB
            # Access the attribute value that TypeDecorator will process
            final_check = db_category.transaction_type
            if isinstance(final_check, TransactionType):
                # If somehow it's still an enum, force conversion
                logger.warning(f"transaction_type is still enum {final_check}, converting to {final_check.value}")
                db_category.__dict__['transaction_type'] = final_check.value
                db_category.transaction_type = final_check.value
            elif isinstance(final_check, str) and final_check != final_check.lower():
                # If it's uppercase, convert
                logger.warning(f"transaction_type is uppercase '{final_check}', converting to lowercase")
                db_category.__dict__['transaction_type'] = final_check.lower()
                db_category.transaction_type = final_check.lower()
            
            # Log final value
            final_value = db_category.__dict__.get('transaction_type') or getattr(db_category, 'transaction_type', None)
            logger.info(f"Final transaction_type before commit: {final_value}, type: {type(final_value)}")
            
            db.add(db_category)
            db.commit()
            db.refresh(db_category)
            
            return db_category
        except ValueError as e:
            db.rollback()
            logger.error(f"Invalid transaction_type value: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный тип транзакции. Используйте: income, expense или both"
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating category: {e}", exc_info=True)
            # Extract user-friendly error message
            error_msg = str(e)
            if "invalid input value for enum" in error_msg.lower():
                error_msg = "Неверный тип транзакции. Используйте: income, expense или both"
            elif "duplicate key" in error_msg.lower() or "unique constraint" in error_msg.lower():
                error_msg = "Категория с таким именем уже существует"
            else:
                # Keep technical details for debugging but show user-friendly message
                error_msg = "Ошибка при создании категории. Попробуйте еще раз."
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error in create_category: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the category"
        )


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
    
    # Handle transaction_type conversion if present
    if 'transaction_type' in update_data:
        transaction_type_value = update_data['transaction_type']
        # Ensure it's properly converted to lowercase string
        # TypeDecorator will handle the conversion, but we ensure lowercase string for safety
        if isinstance(transaction_type_value, TransactionType):
            # Get the lowercase value from enum
            update_data['transaction_type'] = transaction_type_value.value
        elif isinstance(transaction_type_value, str):
            # Convert string to lowercase
            update_data['transaction_type'] = transaction_type_value.lower()
        else:
            # Fallback: convert to lowercase string
            update_data['transaction_type'] = str(transaction_type_value).lower()
        
        # Validate the value is one of the allowed values
        if update_data['transaction_type'] not in ['income', 'expense', 'both']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный тип транзакции. Используйте: income, expense или both"
            )
    
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

