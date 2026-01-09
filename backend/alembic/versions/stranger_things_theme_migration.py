"""add_stranger_things_theme_to_users

Revision ID: stranger_things_001
Revises: 13207bd6f14e
Create Date: 2025-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'stranger_things_001'
down_revision = '13207bd6f14e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('stranger_things_theme', sa.Boolean(), nullable=True, server_default='false'))
    op.execute("UPDATE users SET stranger_things_theme = false WHERE stranger_things_theme IS NULL")
    op.alter_column('users', 'stranger_things_theme', nullable=False, server_default='false')


def downgrade() -> None:
    op.drop_column('users', 'stranger_things_theme')
