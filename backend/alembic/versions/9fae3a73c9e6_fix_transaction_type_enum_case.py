"""fix_transaction_type_enum_case

Revision ID: 9fae3a73c9e6
Revises: 5da608aa4f3b
Create Date: 2025-11-16 15:14:19.122303

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9fae3a73c9e6'
down_revision = '5da608aa4f3b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Проверяем, какой enum сейчас в БД и исправляем, если нужно
    # Если enum все еще в верхнем регистре, конвертируем в нижний
    
    op.execute("""
        DO $$
        DECLARE
            enum_exists boolean;
            enum_values text[];
        BEGIN
            -- Проверяем, существует ли enum transactiontype
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'transactiontype'
            ) INTO enum_exists;
            
            IF enum_exists THEN
                -- Получаем все значения enum
                SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
                INTO enum_values
                FROM pg_enum
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transactiontype');
                
                -- Если enum содержит значения в верхнем регистре, исправляем
                IF 'INCOME' = ANY(enum_values) OR 'EXPENSE' = ANY(enum_values) OR 'TRANSFER' = ANY(enum_values) THEN
                    -- Создаем новый enum с правильными значениями
                    CREATE TYPE transactiontype_fixed AS ENUM ('income', 'expense', 'transfer', 'both');
                    
                    -- Конвертируем данные в transactions
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
                    
                    -- Конвертируем данные в categories, если колонка существует
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
                    
                    -- Удаляем старый enum
                    DROP TYPE transactiontype CASCADE;
                    
                    -- Переименовываем новый enum
                    ALTER TYPE transactiontype_fixed RENAME TO transactiontype;
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Возвращаем enum в верхний регистр (если нужно)
    op.execute("""
        DO $$
        BEGIN
            -- Проверяем, существует ли enum transactiontype
            IF EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'transactiontype'
            ) THEN
                -- Создаем enum с верхним регистром
                CREATE TYPE transactiontype_upper AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'BOTH');
                
                -- Конвертируем данные в transactions
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
                
                -- Конвертируем данные в categories, если колонка существует
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
                
                -- Удаляем старый enum
                DROP TYPE transactiontype CASCADE;
                
                -- Переименовываем новый enum
                ALTER TYPE transactiontype_upper RENAME TO transactiontype;
            END IF;
        END $$;
    """)
