"""add_is_premium_to_users

Revision ID: 47c36052546a
Revises: 9b5ae8cad80b
Create Date: 2025-11-29 12:22:41.693391

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '47c36052546a'
down_revision = '9b5ae8cad80b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_premium', sa.Boolean(), nullable=True, server_default='false'))
    op.execute("UPDATE users SET is_premium = false WHERE is_premium IS NULL")
    op.alter_column('users', 'is_premium', nullable=False, server_default='false')


def downgrade() -> None:
    op.drop_column('users', 'is_premium')

