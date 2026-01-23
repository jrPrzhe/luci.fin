#!/usr/bin/env python3
"""Script to fix system categories names with correct full names"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from sqlalchemy import text as sa_text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mapping of incorrect/truncated names to correct full names
NAME_FIXES = {
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
    # Also check for partial matches
    "Связь и инт": "Связь и интернет",
    "Развлеч": "Развлечения",
    "Образован": "Образование",
    "Красота и у": "Красота и уход",
    "Кино и те": "Кино и театр",
    "Коммуналь": "Коммунальные услуги",
    "Кафе и ре": "Кафе и рестораны",
    "Доставка": "Доставка еды",
    "Бытовая": "Бытовая техника",
    "Домашние": "Домашние животные",
}

def decode_escape_sequence(escaped_str):
    """Decode PostgreSQL escape sequence to UTF-8 string"""
    if not escaped_str or not isinstance(escaped_str, str):
        return escaped_str
    
    if escaped_str.startswith('\\'):
        try:
            parts = escaped_str.split('\\')
            bytes_list = []
            for part in parts:
                if part:
                    try:
                        byte_val = int(part, 8)
                        bytes_list.append(byte_val)
                    except ValueError:
                        pass
            
            if bytes_list:
                return bytes(bytes_list).decode('utf-8', errors='replace')
        except Exception as e:
            logger.warning(f"Error decoding escape sequence: {e}")
    
    return escaped_str

def fix_system_categories():
    """Fix system categories with correct full names"""
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
        print(f"Found {len(rows)} system categories to check")
        print(f"{'='*60}\n")
        
        categories_to_fix = []
        
        for cat_id, user_id, name_bytes, trans_type in rows:
            # Decode if it's an escape sequence
            decoded_name = name_bytes
            if name_bytes and name_bytes.startswith('\\'):
                decoded_name = decode_escape_sequence(name_bytes)
            
            # Check if name needs fixing
            correct_name = None
            if decoded_name in NAME_FIXES:
                correct_name = NAME_FIXES[decoded_name]
            else:
                # Check for partial matches (startswith)
                for truncated, full in NAME_FIXES.items():
                    if decoded_name and decoded_name.startswith(truncated) and len(decoded_name) < len(full):
                        correct_name = full
                        break
            
            if correct_name and correct_name != decoded_name:
                categories_to_fix.append((cat_id, user_id, decoded_name, correct_name, trans_type))
                print(f"Category {cat_id} (user {user_id}): '{decoded_name}' → '{correct_name}'")
        
        print(f"\n{'='*60}")
        print(f"Categories to fix: {len(categories_to_fix)}")
        print(f"{'='*60}\n")
        
        if categories_to_fix:
            print("Fixing categories...")
            fixed_count = 0
            for cat_id, user_id, old_name, correct_name, trans_type in categories_to_fix:
                try:
                    update_sql = """
                        UPDATE categories
                        SET name = :name_utf8
                        WHERE id = :cat_id
                    """
                    db.execute(sa_text(update_sql), {"name_utf8": correct_name, "cat_id": cat_id})
                    db.commit()
                    print(f"  ✓ Fixed category {cat_id} (user {user_id}): '{old_name}' → '{correct_name}'")
                    fixed_count += 1
                except Exception as e:
                    print(f"  ✗ Error fixing category {cat_id}: {e}")
                    db.rollback()
            
            print(f"\n{'='*60}")
            print(f"SUMMARY:")
            print(f"  Total categories checked: {len(rows)}")
            print(f"  Categories fixed: {fixed_count}")
            print(f"{'='*60}\n")
        else:
            print("No categories need fixing!")
        
    except Exception as e:
        logger.error(f"Error fixing categories: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_system_categories()

















