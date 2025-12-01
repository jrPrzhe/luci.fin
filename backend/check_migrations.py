#!/usr/bin/env python3
"""Script to check which migrations are applied in the database"""

import os
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    print("🔍 Checking database migrations...")
    print(f"Database URL: {settings.DATABASE_URL[:50]}...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as conn:
            # Check alembic version
            print("\n📋 Alembic version in database:")
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                version = result.fetchone()
                if version:
                    print(f"   Current version: {version[0]}")
                else:
                    print("   No version found (migrations may not have been run)")
            except Exception as e:
                print(f"   Error checking alembic_version: {e}")
            
            # Check transactiontype enum values
            print("\n📋 TransactionType enum values in database:")
            try:
                result = conn.execute(text("""
                    SELECT enumlabel 
                    FROM pg_enum 
                    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transactiontype')
                    ORDER BY enumsortorder
                """))
                enum_values = result.fetchall()
                if enum_values:
                    print("   Enum values:")
                    for row in enum_values:
                        print(f"     - {row[0]}")
                else:
                    print("   No enum values found")
            except Exception as e:
                print(f"   Error checking enum: {e}")
            
            # Check sample transactions
            print("\n📋 Sample transactions (first 5):")
            try:
                result = conn.execute(text("""
                    SELECT id, transaction_type::text, amount, description 
                    FROM transactions 
                    ORDER BY id DESC 
                    LIMIT 5
                """))
                transactions = result.fetchall()
                if transactions:
                    for row in transactions:
                        print(f"   ID {row[0]}: type='{row[1]}', amount={row[2]}, desc='{row[3][:30] if row[3] else 'None'}...'")
                else:
                    print("   No transactions found")
            except Exception as e:
                print(f"   Error checking transactions: {e}")
        
        print("\n✅ Check completed!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()








