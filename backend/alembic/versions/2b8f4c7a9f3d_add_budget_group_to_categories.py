"""add_budget_group_to_categories

Revision ID: 2b8f4c7a9f3d
Revises: 12934df81cc2
Create Date: 2026-01-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2b8f4c7a9f3d'
down_revision = '12934df81cc2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('categories', sa.Column('budget_group', sa.String(length=20), nullable=True))
    op.execute(
        """
        UPDATE categories
        SET budget_group = 'needs'
        WHERE budget_group IS NULL
          AND LOWER(transaction_type::text) IN ('expense', 'both')
        """
    )


def downgrade() -> None:
    op.drop_column('categories', 'budget_group')
