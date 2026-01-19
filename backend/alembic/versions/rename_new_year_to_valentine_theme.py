"""rename_new_year_theme_to_valentine_theme

Revision ID: rename_valentine_001
Revises: stranger_things_001
Create Date: 2025-01-19 20:14:19.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'rename_valentine_001'
down_revision = 'stranger_things_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Переименовываем колонку new_year_theme в valentine_theme
    op.alter_column('users', 'new_year_theme', new_column_name='valentine_theme')


def downgrade() -> None:
    # Возвращаем обратно к new_year_theme
    op.alter_column('users', 'valentine_theme', new_column_name='new_year_theme')
