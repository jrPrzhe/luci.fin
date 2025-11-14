"""
Script to add shared_budget_id column to accounts table
"""
import sqlite3
import os
from pathlib import Path

# Get database path
db_path = Path(__file__).parent / "finance.db"

if not db_path.exists():
    print(f"Database not found at {db_path}")
    exit(1)

print(f"Connecting to database: {db_path}")
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Check if column already exists
    cursor.execute("PRAGMA table_info(accounts)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'shared_budget_id' in columns:
        print("Column shared_budget_id already exists in accounts table")
    else:
        print("Adding shared_budget_id column to accounts table...")
        cursor.execute("""
            ALTER TABLE accounts 
            ADD COLUMN shared_budget_id INTEGER
        """)
        
        # Create index for better performance
        print("Creating index on shared_budget_id...")
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_accounts_shared_budget_id 
                ON accounts(shared_budget_id)
            """)
        except sqlite3.OperationalError as e:
            if "already exists" not in str(e).lower():
                raise
        
        conn.commit()
        print("Successfully added shared_budget_id column and index")
    
    # Verify
    cursor.execute("PRAGMA table_info(accounts)")
    columns = cursor.fetchall()
    print("\nCurrent accounts table structure:")
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")
    
except Exception as e:
    conn.rollback()
    print(f"Error: {e}")
    raise
finally:
    conn.close()
    print("\nDatabase connection closed")









