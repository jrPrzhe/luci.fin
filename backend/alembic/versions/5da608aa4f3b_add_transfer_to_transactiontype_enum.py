"""add_transfer_to_transactiontype_enum

Revision ID: 5da608aa4f3b
Revises: 
Create Date: 2025-11-16 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5da608aa4f3b'
down_revision: Union[str, None] = '3f8ef46fad30'  # Следует за миграцией gamification
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проблема: в базе данных enum создан с 'INCOME', 'EXPENSE', 'TRANSFER', 'BOTH' (верхний регистр),
    # но код использует 'income', 'expense', 'transfer', 'both' (нижний регистр)
    # Enum используется в таблицах: transactions (INCOME, EXPENSE, TRANSFER) и categories (INCOME, EXPENSE, BOTH)
    # Нужно изменить enum на нижний регистр
    
    # Сначала создаем новый enum с правильными значениями (нижний регистр)
    # Включаем 'both' для categories
    op.execute("CREATE TYPE transactiontype_new AS ENUM ('income', 'expense', 'transfer', 'both')")
    
    # Изменяем колонку в таблице transactions
    op.execute("""
        ALTER TABLE transactions 
        ALTER COLUMN transaction_type 
        TYPE transactiontype_new 
        USING CASE 
            WHEN transaction_type::text = 'INCOME' THEN 'income'::transactiontype_new
            WHEN transaction_type::text = 'EXPENSE' THEN 'expense'::transactiontype_new
            WHEN transaction_type::text = 'TRANSFER' THEN 'transfer'::transactiontype_new
            ELSE 'expense'::transactiontype_new
        END
    """)
    
    # Изменяем колонку в таблице categories
    # Проверяем, существует ли колонка transaction_type в categories
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'categories' 
                AND column_name = 'transaction_type'
            ) THEN
                ALTER TABLE categories 
                ALTER COLUMN transaction_type 
                TYPE transactiontype_new 
                USING CASE 
                    WHEN transaction_type::text = 'INCOME' THEN 'income'::transactiontype_new
                    WHEN transaction_type::text = 'EXPENSE' THEN 'expense'::transactiontype_new
                    WHEN transaction_type::text = 'BOTH' THEN 'both'::transactiontype_new
                    ELSE 'both'::transactiontype_new
                END;
            END IF;
        END $$;
    """)
    
    # Удаляем старый enum (теперь можно, так как все зависимости обновлены)
    op.execute("DROP TYPE transactiontype CASCADE")
    
    # Переименовываем новый enum
    op.execute("ALTER TYPE transactiontype_new RENAME TO transactiontype")


def downgrade() -> None:
    # Возвращаем старый enum с верхним регистром
    op.execute("CREATE TYPE transactiontype_old AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'BOTH')")
    
    # Изменяем колонку в transactions обратно
    op.execute("""
        ALTER TABLE transactions 
        ALTER COLUMN transaction_type 
        TYPE transactiontype_old 
        USING CASE 
            WHEN transaction_type::text = 'income' THEN 'INCOME'::transactiontype_old
            WHEN transaction_type::text = 'expense' THEN 'EXPENSE'::transactiontype_old
            WHEN transaction_type::text = 'transfer' THEN 'TRANSFER'::transactiontype_old
            ELSE 'EXPENSE'::transactiontype_old
        END
    """)
    
    # Изменяем колонку в categories обратно
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'categories' 
                AND column_name = 'transaction_type'
            ) THEN
                ALTER TABLE categories 
                ALTER COLUMN transaction_type 
                TYPE transactiontype_old 
                USING CASE 
                    WHEN transaction_type::text = 'income' THEN 'INCOME'::transactiontype_old
                    WHEN transaction_type::text = 'expense' THEN 'EXPENSE'::transactiontype_old
                    WHEN transaction_type::text = 'both' THEN 'BOTH'::transactiontype_old
                    ELSE 'BOTH'::transactiontype_old
                END;
            END IF;
        END $$;
    """)
    
    # Удаляем новый enum
    op.execute("DROP TYPE transactiontype CASCADE")
    
    # Переименовываем старый enum
    op.execute("ALTER TYPE transactiontype_old RENAME TO transactiontype")
