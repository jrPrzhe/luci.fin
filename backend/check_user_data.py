#!/usr/bin/env python3
"""Script to check user data in database for encoding issues"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction
from sqlalchemy import text as sa_text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_user_data():
    """Check categories and transactions for user 'Дмитрий Пржерадский'"""
    db = SessionLocal()
    
    try:
        # Find user
        user = db.query(User).filter(
            (User.first_name == "Дмитрий") & (User.last_name == "Пржерадский")
        ).first()
        
        if not user:
            print("User not found!")
            return
        
        print(f"\n{'='*60}")
        print(f"User found: {user.first_name} {user.last_name} (ID: {user.id})")
        print(f"Email: {user.email}")
        print(f"{'='*60}\n")
        
        # Check categories with raw SQL (reading as bytea to avoid encoding errors)
        print("CATEGORIES:")
        print("-" * 60)
        problematic_categories = []
        
        try:
            # First, try to get category IDs only
            sql_query_ids = """
                SELECT id
                FROM categories
                WHERE user_id = :user_id
                ORDER BY id
            """
            result_ids = db.execute(sa_text(sql_query_ids), {"user_id": user.id})
            category_ids = [row[0] for row in result_ids.fetchall()]
            print(f"Found {len(category_ids)} category IDs")
            
            # Helper to safely decode
            def safe_decode(value):
                if value is None:
                    return None
                if isinstance(value, bytes):
                    try:
                        return value.decode('utf-8', errors='replace')
                    except:
                        try:
                            return value.decode('latin-1', errors='replace')
                        except:
                            return value.decode('cp1251', errors='replace')
                if isinstance(value, str):
                    try:
                        value.encode('utf-8')
                        return value
                    except UnicodeEncodeError:
                        try:
                            return value.encode('latin-1').decode('utf-8', errors='replace')
                        except:
                            try:
                                return value.encode('cp1251').decode('utf-8', errors='replace')
                            except:
                                return value.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
                return value
            
            # Now try to read each category individually with bytea conversion
            for cat_id in category_ids:
                try:
                    sql_query = """
                        SELECT id, 
                        encode(name::bytea, 'escape')::text as name_bytes,
                        transaction_type::text, 
                        encode(icon::bytea, 'escape')::text as icon_bytes,
                        encode(color::bytea, 'escape')::text as color_bytes
                        FROM categories
                        WHERE id = :cat_id
                    """
                    result = db.execute(sa_text(sql_query), {"cat_id": cat_id})
                    row = result.fetchone()
                    
                    if row:
                        cat_id, name_bytes, trans_type, icon_bytes, color_bytes = row
                        safe_name = safe_decode(name_bytes)
                        safe_icon = safe_decode(icon_bytes)
                        safe_color = safe_decode(color_bytes)
                        
                        print(f"  ✓ Category {cat_id}: {safe_name[:40] if safe_name else 'NULL'} (type: {trans_type})")
                    else:
                        print(f"  ? Category {cat_id}: Not found")
                except Exception as e:
                    problematic_categories.append(cat_id)
                    print(f"  ✗ Category {cat_id}: ERROR - {e}")
                    db.rollback()  # Rollback after error
        except Exception as e:
            print(f"  ERROR executing SQL: {e}")
            db.rollback()
            import traceback
            traceback.print_exc()
        
        # Check transactions with raw SQL (reading as bytea to avoid encoding errors)
        print(f"\n{'='*60}")
        print("TRANSACTIONS:")
        print("-" * 60)
        problematic_transactions = []
        
        try:
            # First, get transaction IDs only
            sql_query_ids = """
                SELECT id
                FROM transactions
                WHERE user_id = :user_id
                ORDER BY transaction_date DESC
                LIMIT 50
            """
            result_ids = db.execute(sa_text(sql_query_ids), {"user_id": user.id})
            transaction_ids = [row[0] for row in result_ids.fetchall()]
            print(f"Found {len(transaction_ids)} transactions (showing first 50)")
            
            # Helper to safely decode
            def safe_decode(value):
                if value is None:
                    return None
                if isinstance(value, bytes):
                    try:
                        return value.decode('utf-8', errors='replace')
                    except:
                        try:
                            return value.decode('latin-1', errors='replace')
                        except:
                            return value.decode('cp1251', errors='replace')
                if isinstance(value, str):
                    try:
                        value.encode('utf-8')
                        return value
                    except UnicodeEncodeError:
                        try:
                            return value.encode('latin-1').decode('utf-8', errors='replace')
                        except:
                            try:
                                return value.encode('cp1251').decode('utf-8', errors='replace')
                            except:
                                return value.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
                return value
            
            # Read each transaction individually with bytea conversion
            for trans_id in transaction_ids:
                try:
                    sql_query = """
                        SELECT id, transaction_type::text, amount, currency,
                        CASE 
                            WHEN description IS NOT NULL THEN 
                                encode(description::bytea, 'escape')::text
                            ELSE NULL
                        END as description_bytes,
                        transaction_date, category_id
                        FROM transactions
                        WHERE id = :trans_id
                    """
                    result = db.execute(sa_text(sql_query), {"trans_id": trans_id})
                    row = result.fetchone()
                    
                    if row:
                        trans_id, trans_type, amount, currency, description_bytes, trans_date, category_id = row
                        safe_desc = safe_decode(description_bytes)
                        desc_preview = safe_desc[:40] if safe_desc else "NULL"
                        print(f"  ✓ Transaction {trans_id}: {trans_type} - {amount} {currency} | {desc_preview} | {trans_date}")
                    else:
                        print(f"  ? Transaction {trans_id}: Not found")
                except Exception as e:
                    problematic_transactions.append(trans_id)
                    print(f"  ✗ Transaction {trans_id}: ERROR - {e}")
                    db.rollback()  # Rollback after error
        except Exception as e:
            print(f"  ERROR executing SQL: {e}")
            db.rollback()
            import traceback
            traceback.print_exc()
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY:")
        print(f"  Problematic categories: {len(problematic_categories)}")
        print(f"  Problematic transactions: {len(problematic_transactions)}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        logger.error(f"Error checking user data: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    check_user_data()

