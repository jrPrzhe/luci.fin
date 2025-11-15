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
    # Проверяем, существует ли уже значение 'transfer' в enum
    # Если enum использует верхний регистр, нужно изменить его на нижний
    
    # Сначала создаем новый enum с правильными значениями (нижний регистр)
    op.execute("CREATE TYPE transactiontype_new AS ENUM ('income', 'expense', 'transfer')")
    
    # Изменяем колонку, чтобы использовать новый enum
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
    
    # Удаляем старый enum
    op.execute("DROP TYPE transactiontype")
    
    # Переименовываем новый enum
    op.execute("ALTER TYPE transactiontype_new RENAME TO transactiontype")


def downgrade() -> None:
    # Возвращаем старый enum с верхним регистром
    op.execute("CREATE TYPE transactiontype_old AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER')")
    
    # Изменяем колонку обратно
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
    
    # Удаляем новый enum
    op.execute("DROP TYPE transactiontype")
    
    # Переименовываем старый enum
    op.execute("ALTER TYPE transactiontype_old RENAME TO transactiontype")
