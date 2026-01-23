#!/usr/bin/env python3
"""Script to check and fix encoding issues for all users"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from sqlalchemy import text as sa_text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def decode_escape_sequence(escaped_str):
    """Decode PostgreSQL escape sequence to UTF-8 string"""
    if not escaped_str or not isinstance(escaped_str, str):
        return escaped_str
    
    # Remove leading backslash if present
    if escaped_str.startswith('\\'):
        # This is a PostgreSQL escape sequence
        # Convert \320\237 to bytes and decode
        try:
            # Split by backslash and convert octal to bytes
            parts = escaped_str.split('\\')
            bytes_list = []
            for part in parts:
                if part:
                    try:
                        # Try to interpret as octal
                        byte_val = int(part, 8)
                        bytes_list.append(byte_val)
                    except ValueError:
                        # Not octal, keep as is
                        pass
            
            if bytes_list:
                # Decode bytes as UTF-8
                return bytes(bytes_list).decode('utf-8', errors='replace')
        except Exception as e:
            logger.warning(f"Error decoding escape sequence: {e}")
    
    return escaped_str

def check_and_fix_all_users():
    """Check and fix encoding issues for all users"""
    db = SessionLocal()
    
    try:
        # Get all user IDs
        sql_query_users = """
            SELECT id, first_name, last_name, email
            FROM users
            ORDER BY id
        """
        result_users = db.execute(sa_text(sql_query_users))
        users = result_users.fetchall()
        
        print(f"\n{'='*60}")
        print(f"Found {len(users)} users to check")
        print(f"{'='*60}\n")
        
        total_categories_fixed = 0
        total_transactions_fixed = 0
        users_with_issues = 0
        
        for user_id, first_name, last_name, email in users:
            try:
                print(f"\nChecking user {user_id}: {first_name} {last_name} ({email})")
                print("-" * 60)
                
                # Check categories
                sql_query_ids = """
                    SELECT id
                    FROM categories
                    WHERE user_id = :user_id
                    ORDER BY id
                """
                result_ids = db.execute(sa_text(sql_query_ids), {"user_id": user_id})
                category_ids = [row[0] for row in result_ids.fetchall()]
                
                categories_fixed = 0
                for cat_id in category_ids:
                    try:
                        # Get category data as bytea
                        sql_query = """
                            SELECT 
                                encode(name::bytea, 'escape')::text as name_bytes
                            FROM categories
                            WHERE id = :cat_id
                        """
                        result = db.execute(sa_text(sql_query), {"cat_id": cat_id})
                        row = result.fetchone()
                        
                        if row and row[0]:
                            name_bytes = row[0]
                            
                            # Check if name needs fixing
                            if name_bytes.startswith('\\'):
                                # This is an escape sequence, decode it
                                decoded_name = decode_escape_sequence(name_bytes)
                                
                                if decoded_name and decoded_name != name_bytes:
                                    # Update category name
                                    try:
                                        update_sql = """
                                            UPDATE categories
                                            SET name = :name_utf8
                                            WHERE id = :cat_id
                                        """
                                        db.execute(sa_text(update_sql), {"name_utf8": decoded_name, "cat_id": cat_id})
                                        db.commit()
                                        categories_fixed += 1
                                    except Exception as e:
                                        logger.warning(f"Error fixing category {cat_id}: {e}")
                                        db.rollback()
                    except Exception as e:
                        logger.warning(f"Error processing category {cat_id}: {e}")
                        db.rollback()
                
                if categories_fixed > 0:
                    print(f"  ✓ Fixed {categories_fixed} categories")
                    total_categories_fixed += categories_fixed
                    users_with_issues += 1
                
                # Check transactions
                sql_query_ids = """
                    SELECT id
                    FROM transactions
                    WHERE user_id = :user_id
                    ORDER BY id
                """
                result_ids = db.execute(sa_text(sql_query_ids), {"user_id": user_id})
                transaction_ids = [row[0] for row in result_ids.fetchall()]
                
                transactions_fixed = 0
                for trans_id in transaction_ids:
                    try:
                        # Get transaction description as bytea
                        sql_query = """
                            SELECT 
                                CASE 
                                    WHEN description IS NOT NULL THEN 
                                        encode(description::bytea, 'escape')::text
                                    ELSE NULL
                                END as description_bytes
                            FROM transactions
                            WHERE id = :trans_id
                        """
                        result = db.execute(sa_text(sql_query), {"trans_id": trans_id})
                        row = result.fetchone()
                        
                        if row and row[0]:
                            desc_bytes = row[0]
                            
                            # Check if description needs fixing
                            if desc_bytes.startswith('\\'):
                                # This is an escape sequence, decode it
                                decoded_desc = decode_escape_sequence(desc_bytes)
                                
                                if decoded_desc and decoded_desc != desc_bytes:
                                    # Update transaction description
                                    try:
                                        update_sql = """
                                            UPDATE transactions
                                            SET description = :desc_utf8
                                            WHERE id = :trans_id
                                        """
                                        db.execute(sa_text(update_sql), {"desc_utf8": decoded_desc, "trans_id": trans_id})
                                        db.commit()
                                        transactions_fixed += 1
                                    except Exception as e:
                                        logger.warning(f"Error fixing transaction {trans_id}: {e}")
                                        db.rollback()
                    except Exception as e:
                        logger.warning(f"Error processing transaction {trans_id}: {e}")
                        db.rollback()
                
                if transactions_fixed > 0:
                    print(f"  ✓ Fixed {transactions_fixed} transactions")
                    total_transactions_fixed += transactions_fixed
                    users_with_issues += 1
                
                if categories_fixed == 0 and transactions_fixed == 0:
                    print(f"  ✓ No issues found")
                
            except Exception as e:
                logger.error(f"Error processing user {user_id}: {e}")
                db.rollback()
        
        print(f"\n{'='*60}")
        print("SUMMARY:")
        print(f"  Total users checked: {len(users)}")
        print(f"  Users with issues: {users_with_issues}")
        print(f"  Total categories fixed: {total_categories_fixed}")
        print(f"  Total transactions fixed: {total_transactions_fixed}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        logger.error(f"Error checking users: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    check_and_fix_all_users()

















