"""Remove unique constraints from telegram_id and vk_id for account linking

Revision ID: aad864ea483a
Revises: bd53837546bb
Create Date: 2025-11-15 00:13:34.689606

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aad864ea483a'
down_revision = 'bd53837546bb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove unique constraints from telegram_id and vk_id to allow account linking
    # This allows one user to have both telegram_id and vk_id
    
    # Drop unique index on telegram_id if it exists
    op.execute("DROP INDEX IF EXISTS ix_users_telegram_id")
    # Create non-unique index
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=False)
    
    # Drop unique index on vk_id if it exists
    op.execute("DROP INDEX IF EXISTS ix_users_vk_id")
    # Create non-unique index
    op.create_index('ix_users_vk_id', 'users', ['vk_id'], unique=False)


def downgrade() -> None:
    # Restore unique constraints (note: this may fail if there are duplicate values)
    # Drop non-unique indexes
    op.drop_index('ix_users_telegram_id', table_name='users')
    op.drop_index('ix_users_vk_id', table_name='users')
    
    # Create unique indexes
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)
    op.create_index('ix_users_vk_id', 'users', ['vk_id'], unique=True)

