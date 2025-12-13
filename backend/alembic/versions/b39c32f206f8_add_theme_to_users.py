"""add_theme_to_users

Revision ID: b39c32f206f8
Revises: 4a382c2ee966
Create Date: 2025-01-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b39c32f206f8'
down_revision = '4a382c2ee966'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('theme', sa.String(10), nullable=True, server_default='dark'))
    op.execute("UPDATE users SET theme = 'dark' WHERE theme IS NULL")
    op.alter_column('users', 'theme', nullable=False, server_default='dark')


def downgrade() -> None:
    op.drop_column('users', 'theme')

