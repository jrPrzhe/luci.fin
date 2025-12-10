"""trim_category_names_to_20_chars

Revision ID: cdbfcee9a49f
Revises: 47c36052546a
Create Date: 2025-12-10 11:14:18.709224

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cdbfcee9a49f'
down_revision = '47c36052546a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This migration was rolled back, but the revision exists in the database
    # This is a no-op migration to maintain Alembic history
    pass


def downgrade() -> None:
    # This migration was rolled back, but the revision exists in the database
    # This is a no-op migration to maintain Alembic history
    pass

