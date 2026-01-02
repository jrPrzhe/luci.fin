"""add_used_greetings_to_gamification_profile

Revision ID: 12934df81cc2
Revises: 13207bd6f14e
Create Date: 2026-01-03 01:23:44.510863

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '12934df81cc2'
down_revision = '13207bd6f14e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user_gamification_profiles', sa.Column('used_greetings', sa.Text(), nullable=True))
    op.add_column('user_gamification_profiles', sa.Column('custom_greetings', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_gamification_profiles', 'custom_greetings')
    op.drop_column('user_gamification_profiles', 'used_greetings')

