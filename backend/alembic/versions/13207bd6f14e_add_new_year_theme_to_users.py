"""add_new_year_theme_to_users

Revision ID: 13207bd6f14e
Revises: b39c32f206f8
Create Date: 2025-01-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '13207bd6f14e'
down_revision = 'b39c32f206f8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('new_year_theme', sa.Boolean(), nullable=True, server_default='true'))
    op.execute("UPDATE users SET new_year_theme = true WHERE new_year_theme IS NULL")
    op.alter_column('users', 'new_year_theme', nullable=False, server_default='true')


def downgrade() -> None:
    op.drop_column('users', 'new_year_theme')

