#!/usr/bin/env python3
"""Script to check and fix system categories"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from sqlalchemy import text as sa_text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_system_categories():
    """Check system categories and their encoding"""
    db = SessionLocal()
    
    try:
        # Get all system categories
        sql_query = """
            SELECT id, user_id, 
            encode(name::bytea, 'escape')::text as name_bytes,
            transaction_type::text
            FROM categories
            WHERE is_system = true
            ORDER BY user_id, id
        """
        result = db.execute(sa_text(sql_query))
        rows = result.fetchall()
        
        print(f"\n{'='*60}")
        print(f"Found {len(rows)} system categories")
        print(f"{'='*60}\n")
        
        # Expected full names for common categories
        expected_names = {
            "Связьиинт": "Связь и интернет",
            "Развлечени": "Развлечения",
            "Образовани": "Образование",
            "Крастотаиу": "Красота и уход",
            "Кинотеат": "Кино и театр",
            "Коммунальн": "Коммунальные услуги",
            "Кафеирест": "Кафе и рестораны",
            "Доставкае": "Доставка еды",
            "Бытоваяте": "Бытовая техника",
            "Домашниеж": "Домашние животные",
            "Возвратпо": "Возврат покупок",
        }
        
        categories_to_fix = []
        
        for cat_id, user_id, name_bytes, trans_type in rows:
            print(f"Category {cat_id} (user {user_id}): {name_bytes[:50]}")
            
            # Check if name is truncated or has encoding issues
            if name_bytes and name_bytes.startswith('\\'):
                # Try to decode
                parts = name_bytes.split('\\')
                bytes_list = []
                for part in parts:
                    if part:
                        try:
                            byte_val = int(part, 8)
                            bytes_list.append(byte_val)
                        except ValueError:
                            pass
                
                if bytes_list:
                    try:
                        decoded = bytes(bytes_list).decode('utf-8', errors='replace')
                        print(f"  Decoded: {decoded}")
                        
                        # Check if it matches a known truncated name
                        if decoded in expected_names:
                            categories_to_fix.append((cat_id, user_id, expected_names[decoded], trans_type))
                            print(f"  → Should be: {expected_names[decoded]}")
                    except Exception as e:
                        print(f"  Error decoding: {e}")
            elif name_bytes:
                # Check if it's a known truncated name
                if name_bytes in expected_names:
                    categories_to_fix.append((cat_id, user_id, expected_names[name_bytes], trans_type))
                    print(f"  → Should be: {expected_names[name_bytes]}")
        
        print(f"\n{'='*60}")
        print(f"Categories to fix: {len(categories_to_fix)}")
        print(f"{'='*60}\n")
        
        if categories_to_fix:
            print("Fixing categories...")
            fixed_count = 0
            for cat_id, user_id, correct_name, trans_type in categories_to_fix:
                try:
                    update_sql = """
                        UPDATE categories
                        SET name = :name_utf8
                        WHERE id = :cat_id
                    """
                    db.execute(sa_text(update_sql), {"name_utf8": correct_name, "cat_id": cat_id})
                    db.commit()
                    print(f"  ✓ Fixed category {cat_id} (user {user_id}): {correct_name}")
                    fixed_count += 1
                except Exception as e:
                    print(f"  ✗ Error fixing category {cat_id}: {e}")
                    db.rollback()
            
            print(f"\nFixed {fixed_count} categories")
        
    except Exception as e:
        logger.error(f"Error checking categories: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    check_system_categories()

















