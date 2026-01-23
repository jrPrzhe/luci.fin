#!/usr/bin/env python3
"""Script to fix encoding issues in user data"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from app.models.user import User
from sqlalchemy import text as sa_text
import logging
import re

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

def fix_user_data():
    """Fix encoding issues for user 'Дмитрий Пржерадский'"""
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
        print(f"Fixing data for user: {user.first_name} {user.last_name} (ID: {user.id})")
        print(f"{'='*60}\n")
        
        # Fix categories
        print("FIXING CATEGORIES:")
        print("-" * 60)
        
        # Get category IDs
        sql_query_ids = """
            SELECT id
            FROM categories
            WHERE user_id = :user_id
            ORDER BY id
        """
        result_ids = db.execute(sa_text(sql_query_ids), {"user_id": user.id})
        category_ids = [row[0] for row in result_ids.fetchall()]
        print(f"Found {len(category_ids)} categories to check")
        
        fixed_count = 0
        for cat_id in category_ids:
            try:
                # Get category data as bytea
                sql_query = """
                    SELECT 
                        encode(name::bytea, 'escape')::text as name_bytes,
                        encode(icon::bytea, 'escape')::text as icon_bytes,
                        encode(color::bytea, 'escape')::text as color_bytes
                    FROM categories
                    WHERE id = :cat_id
                """
                result = db.execute(sa_text(sql_query), {"cat_id": cat_id})
                row = result.fetchone()
                
                if row:
                    name_bytes, icon_bytes, color_bytes = row
                    
                    # Decode name
                    if name_bytes and name_bytes.startswith('\\'):
                        # This is an escape sequence, decode it
                        decoded_name = decode_escape_sequence(name_bytes)
                        
                        if decoded_name and decoded_name != name_bytes:
                            # Update category name using direct UTF-8 string
                            try:
                                # Try direct update with UTF-8 string
                                update_sql = """
                                    UPDATE categories
                                    SET name = :name_utf8
                                    WHERE id = :cat_id
                                """
                                db.execute(sa_text(update_sql), {"name_utf8": decoded_name, "cat_id": cat_id})
                                db.commit()  # Commit immediately
                                print(f"  ✓ Fixed category {cat_id}: {decoded_name[:40]}")
                                fixed_count += 1
                            except Exception as e:
                                print(f"  ✗ Error fixing category {cat_id}: {e}")
                                db.rollback()
                                # Try alternative method
                                try:
                                    # Use bytea conversion
                                    name_bytes_utf8 = decoded_name.encode('utf-8')
                                    update_sql2 = """
                                        UPDATE categories
                                        SET name = convert_from(:name_bytes, 'UTF8')
                                        WHERE id = :cat_id
                                    """
                                    db.execute(sa_text(update_sql2), {"name_bytes": name_bytes_utf8, "cat_id": cat_id})
                                    db.commit()
                                    print(f"  ✓ Fixed category {cat_id} (method 2): {decoded_name[:40]}")
                                    fixed_count += 1
                                except Exception as e2:
                                    print(f"  ✗ Error fixing category {cat_id} (method 2): {e2}")
                                    db.rollback()
                    else:
                        # Name seems OK, check if it's valid UTF-8
                        try:
                            if name_bytes:
                                name_bytes.encode('utf-8')
                        except UnicodeEncodeError:
                            # Try to fix it
                            try:
                                decoded_name = name_bytes.encode('latin-1').decode('utf-8', errors='replace')
                                name_hex = decoded_name.encode('utf-8').hex()
                                update_sql = """
                                    UPDATE categories
                                    SET name = convert_from(decode(:name_hex, 'hex'), 'UTF8')
                                    WHERE id = :cat_id
                                """
                                db.execute(sa_text(update_sql), {"name_hex": name_hex, "cat_id": cat_id})
                                print(f"  ✓ Fixed category {cat_id}: {decoded_name[:40]}")
                                fixed_count += 1
                            except Exception as e:
                                print(f"  ✗ Error fixing category {cat_id}: {e}")
                                db.rollback()
                
            except Exception as e:
                print(f"  ✗ Error processing category {cat_id}: {e}")
                db.rollback()
        
        db.commit()
        print(f"\nFixed {fixed_count} categories")
        
        # Fix transactions
        print(f"\n{'='*60}")
        print("FIXING TRANSACTIONS:")
        print("-" * 60)
        
        # Get transaction IDs
        sql_query_ids = """
            SELECT id
            FROM transactions
            WHERE user_id = :user_id
            ORDER BY id
        """
        result_ids = db.execute(sa_text(sql_query_ids), {"user_id": user.id})
        transaction_ids = [row[0] for row in result_ids.fetchall()]
        print(f"Found {len(transaction_ids)} transactions to check")
        
        fixed_count = 0
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
                                desc_hex = decoded_desc.encode('utf-8').hex()
                                update_sql = """
                                    UPDATE transactions
                                    SET description = convert_from(decode(:desc_hex, 'hex'), 'UTF8')
                                    WHERE id = :trans_id
                                """
                                db.execute(sa_text(update_sql), {"desc_hex": desc_hex, "trans_id": trans_id})
                                print(f"  ✓ Fixed transaction {trans_id}: {decoded_desc[:40]}")
                                fixed_count += 1
                            except Exception as e:
                                print(f"  ✗ Error fixing transaction {trans_id}: {e}")
                                db.rollback()
                    else:
                        # Check if valid UTF-8
                        try:
                            if desc_bytes:
                                desc_bytes.encode('utf-8')
                        except UnicodeEncodeError:
                            # Try to fix it
                            try:
                                decoded_desc = desc_bytes.encode('latin-1').decode('utf-8', errors='replace')
                                desc_hex = decoded_desc.encode('utf-8').hex()
                                update_sql = """
                                    UPDATE transactions
                                    SET description = convert_from(decode(:desc_hex, 'hex'), 'UTF8')
                                    WHERE id = :trans_id
                                """
                                db.execute(sa_text(update_sql), {"desc_hex": desc_hex, "trans_id": trans_id})
                                print(f"  ✓ Fixed transaction {trans_id}: {decoded_desc[:40]}")
                                fixed_count += 1
                            except Exception as e:
                                print(f"  ✗ Error fixing transaction {trans_id}: {e}")
                                db.rollback()
                
            except Exception as e:
                print(f"  ✗ Error processing transaction {trans_id}: {e}")
                db.rollback()
        
        db.commit()
        print(f"\nFixed {fixed_count} transactions")
        
        print(f"\n{'='*60}")
        print("SUMMARY:")
        print(f"  Categories fixed: {fixed_count}")
        print(f"  Transactions fixed: {fixed_count}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        logger.error(f"Error fixing user data: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_user_data()

