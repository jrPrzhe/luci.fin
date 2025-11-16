"""fix_transaction_type_enum_case

Revision ID: 9fae3a73c9e6
Revises: 5da608aa4f3b
Create Date: 2025-11-16 15:14:19.122303

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text as sa_text


# revision identifiers, used by Alembic.
revision = '9fae3a73c9e6'
down_revision = '5da608aa4f3b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check enum case and fix if needed
    # If enum is still uppercase, convert to lowercase
    
    # Use raw SQL execution with proper encoding
    sql = """
        DO $$
        DECLARE
            enum_exists boolean;
            enum_values text[];
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'transactiontype'
            ) INTO enum_exists;
            
            IF enum_exists THEN
                SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
                INTO enum_values
                FROM pg_enum
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transactiontype');
                
                IF 'INCOME' = ANY(enum_values) OR 'EXPENSE' = ANY(enum_values) OR 'TRANSFER' = ANY(enum_values) THEN
                    CREATE TYPE transactiontype_fixed AS ENUM ('income', 'expense', 'transfer', 'both');
                    
                    ALTER TABLE transactions 
                    ALTER COLUMN transaction_type 
                    TYPE transactiontype_fixed 
                    USING CASE 
                        WHEN transaction_type::text = 'INCOME' THEN 'income'::transactiontype_fixed
                        WHEN transaction_type::text = 'EXPENSE' THEN 'expense'::transactiontype_fixed
                        WHEN transaction_type::text = 'TRANSFER' THEN 'transfer'::transactiontype_fixed
                        WHEN transaction_type::text = 'income' THEN 'income'::transactiontype_fixed
                        WHEN transaction_type::text = 'expense' THEN 'expense'::transactiontype_fixed
                        WHEN transaction_type::text = 'transfer' THEN 'transfer'::transactiontype_fixed
                        ELSE 'expense'::transactiontype_fixed
                    END;
                    
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'categories' 
                        AND column_name = 'transaction_type'
                    ) THEN
                        ALTER TABLE categories 
                        ALTER COLUMN transaction_type 
                        TYPE transactiontype_fixed 
                        USING CASE 
                            WHEN transaction_type::text = 'INCOME' THEN 'income'::transactiontype_fixed
                            WHEN transaction_type::text = 'EXPENSE' THEN 'expense'::transactiontype_fixed
                            WHEN transaction_type::text = 'BOTH' THEN 'both'::transactiontype_fixed
                            WHEN transaction_type::text = 'income' THEN 'income'::transactiontype_fixed
                            WHEN transaction_type::text = 'expense' THEN 'expense'::transactiontype_fixed
                            WHEN transaction_type::text = 'both' THEN 'both'::transactiontype_fixed
                            ELSE 'both'::transactiontype_fixed
                        END;
                    END IF;
                    
                    DROP TYPE transactiontype CASCADE;
                    ALTER TYPE transactiontype_fixed RENAME TO transactiontype;
                END IF;
            END IF;
        END $$;
    """
    op.execute(sa_text(sql))


def downgrade() -> None:
    # Revert enum to uppercase if needed
    sql = """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'transactiontype'
            ) THEN
                CREATE TYPE transactiontype_upper AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'BOTH');
                
                ALTER TABLE transactions 
                ALTER COLUMN transaction_type 
                TYPE transactiontype_upper 
                USING CASE 
                    WHEN transaction_type::text = 'income' THEN 'INCOME'::transactiontype_upper
                    WHEN transaction_type::text = 'expense' THEN 'EXPENSE'::transactiontype_upper
                    WHEN transaction_type::text = 'transfer' THEN 'TRANSFER'::transactiontype_upper
                    WHEN transaction_type::text = 'INCOME' THEN 'INCOME'::transactiontype_upper
                    WHEN transaction_type::text = 'EXPENSE' THEN 'EXPENSE'::transactiontype_upper
                    WHEN transaction_type::text = 'TRANSFER' THEN 'TRANSFER'::transactiontype_upper
                    ELSE 'EXPENSE'::transactiontype_upper
                END;
                
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'categories' 
                    AND column_name = 'transaction_type'
                ) THEN
                    ALTER TABLE categories 
                    ALTER COLUMN transaction_type 
                    TYPE transactiontype_upper 
                    USING CASE 
                        WHEN transaction_type::text = 'income' THEN 'INCOME'::transactiontype_upper
                        WHEN transaction_type::text = 'expense' THEN 'EXPENSE'::transactiontype_upper
                        WHEN transaction_type::text = 'both' THEN 'BOTH'::transactiontype_upper
                        WHEN transaction_type::text = 'INCOME' THEN 'INCOME'::transactiontype_upper
                        WHEN transaction_type::text = 'EXPENSE' THEN 'EXPENSE'::transactiontype_upper
                        WHEN transaction_type::text = 'BOTH' THEN 'BOTH'::transactiontype_upper
                        ELSE 'BOTH'::transactiontype_upper
                    END;
                END IF;
                
                DROP TYPE transactiontype CASCADE;
                ALTER TYPE transactiontype_upper RENAME TO transactiontype;
            END IF;
        END $$;
    """
    op.execute(sa_text(sql))
