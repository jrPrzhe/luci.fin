"""add_analytics_events_table

Revision ID: 9c8be056d531
Revises: 9fae3a73c9e6
Create Date: 2025-11-18 12:05:08.311480

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '9c8be056d531'
down_revision = '9fae3a73c9e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create analytics_events table
    op.create_table(
        'analytics_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('vk_id', sa.String(length=50), nullable=True),
        sa.Column('telegram_id', sa.String(length=50), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('event_name', sa.String(length=100), nullable=False),
        sa.Column('platform', sa.String(length=20), nullable=False),
        sa.Column('event_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('referrer', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_analytics_events_user_id'), 'analytics_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_analytics_events_vk_id'), 'analytics_events', ['vk_id'], unique=False)
    op.create_index(op.f('ix_analytics_events_telegram_id'), 'analytics_events', ['telegram_id'], unique=False)
    op.create_index(op.f('ix_analytics_events_event_type'), 'analytics_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_analytics_events_event_name'), 'analytics_events', ['event_name'], unique=False)
    op.create_index(op.f('ix_analytics_events_platform'), 'analytics_events', ['platform'], unique=False)
    op.create_index(op.f('ix_analytics_events_created_at'), 'analytics_events', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_analytics_events_created_at'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_platform'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_event_name'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_event_type'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_telegram_id'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_vk_id'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_user_id'), table_name='analytics_events')
    
    # Drop table
    op.drop_table('analytics_events')

