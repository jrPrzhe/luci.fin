"""add_notification_settings_to_users

Revision ID: 9b5ae8cad80b
Revises: b60144ef8d38
Create Date: 2025-11-26 21:08:33.199825

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b5ae8cad80b'
down_revision = 'b60144ef8d38'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add notification settings columns to users table
    op.add_column('users', sa.Column('telegram_notifications_enabled', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('users', sa.Column('vk_notifications_enabled', sa.Boolean(), nullable=True, server_default='true'))
    
    # Update existing users to have notifications enabled by default
    op.execute("UPDATE users SET telegram_notifications_enabled = true WHERE telegram_notifications_enabled IS NULL")
    op.execute("UPDATE users SET vk_notifications_enabled = true WHERE vk_notifications_enabled IS NULL")
    
    # Make columns NOT NULL after setting defaults
    op.alter_column('users', 'telegram_notifications_enabled', nullable=False, server_default='true')
    op.alter_column('users', 'vk_notifications_enabled', nullable=False, server_default='true')


def downgrade() -> None:
    op.drop_column('users', 'vk_notifications_enabled')
    op.drop_column('users', 'telegram_notifications_enabled')

