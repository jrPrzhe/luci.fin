"""
Migration script to add invite_code column to shared_budgets table
"""
import sqlite3
import os

# Path to database
db_path = os.path.join(os.path.dirname(__file__), 'finance.db')

def migrate():
    """Add invite_code column to shared_budgets table if it doesn't exist"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(shared_budgets)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'invite_code' not in columns:
            print("Adding invite_code column to shared_budgets table...")
            cursor.execute("""
                ALTER TABLE shared_budgets 
                ADD COLUMN invite_code VARCHAR(10)
            """)
            
            # Create index for invite_code
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_shared_budgets_invite_code 
                ON shared_budgets(invite_code)
            """)
            
            conn.commit()
            print("[OK] Column invite_code added successfully")
            
            # Generate invite codes for existing budgets
            cursor.execute("SELECT id FROM shared_budgets WHERE invite_code IS NULL OR invite_code = ''")
            budgets_without_code = cursor.fetchall()
            
            if budgets_without_code:
                print(f"Generating invite codes for {len(budgets_without_code)} existing budgets...")
                
                import secrets
                import string
                
                def generate_invite_code(length: int = 6) -> str:
                    """Generate a short, user-friendly invite code"""
                    alphabet = string.ascii_uppercase.replace('O', '').replace('I', '') + string.digits.replace('0', '').replace('1', '')
                    return ''.join(secrets.choice(alphabet) for _ in range(length))
                
                for (budget_id,) in budgets_without_code:
                    # Generate unique code
                    invite_code = generate_invite_code()
                    # Check uniqueness
                    while True:
                        cursor.execute("SELECT id FROM shared_budgets WHERE invite_code = ?", (invite_code,))
                        if not cursor.fetchone():
                            break
                        invite_code = generate_invite_code()
                    
                    cursor.execute(
                        "UPDATE shared_budgets SET invite_code = ? WHERE id = ?",
                        (invite_code, budget_id)
                    )
                    print(f"  [OK] Budget {budget_id}: {invite_code}")
                
                conn.commit()
                print("[OK] Invite codes generated for existing budgets")
        else:
            print("[OK] Column invite_code already exists")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

