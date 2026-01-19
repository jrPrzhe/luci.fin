"""add_biography_module_and_new_user_field

Revision ID: 5123ef88ebe0
Revises: rename_valentine_001
Create Date: 2026-01-20 02:45:20.053081

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '5123ef88ebe0'
down_revision = 'rename_valentine_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле new_user в таблицу users
    op.add_column('users', sa.Column('new_user', sa.Boolean(), nullable=True, server_default='true'))
    op.execute("UPDATE users SET new_user = true WHERE new_user IS NULL")
    op.alter_column('users', 'new_user', nullable=False, server_default='true')
    
    # Создаем таблицу biographies
    op.create_table('biographies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('monthly_income', sa.Numeric(15, 2), nullable=True),
        sa.Column('problems', sa.Text(), nullable=True),
        sa.Column('goal', sa.Text(), nullable=True),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_biographies_id'), 'biographies', ['id'], unique=False)
    op.create_index(op.f('ix_biographies_user_id'), 'biographies', ['user_id'], unique=False)
    # Уникальность только для текущей биографии пользователя (проверяется на уровне приложения)
    
    # Создаем таблицу questionnaire_responses
    op.create_table('questionnaire_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('biography_id', sa.Integer(), nullable=False),
        sa.Column('category_limits', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('monthly_income', sa.Numeric(15, 2), nullable=True),
        sa.Column('problems_text', sa.Text(), nullable=True),
        sa.Column('problems_options', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('goal_text', sa.Text(), nullable=True),
        sa.Column('goal_options', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['biography_id'], ['biographies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('biography_id')
    )
    op.create_index(op.f('ix_questionnaire_responses_id'), 'questionnaire_responses', ['id'], unique=False)
    op.create_index(op.f('ix_questionnaire_responses_biography_id'), 'questionnaire_responses', ['biography_id'], unique=True)
    
    # Создаем таблицу biography_category_limits
    op.create_table('biography_category_limits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('biography_id', sa.Integer(), nullable=False),
        sa.Column('category_name', sa.String(length=255), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('user_limit', sa.Numeric(15, 2), nullable=False),
        sa.Column('ai_recommended_limit', sa.Numeric(15, 2), nullable=True),
        sa.Column('actual_spent', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['biography_id'], ['biographies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_biography_category_limits_id'), 'biography_category_limits', ['id'], unique=False)
    op.create_index(op.f('ix_biography_category_limits_biography_id'), 'biography_category_limits', ['biography_id'], unique=False)


def downgrade() -> None:
    # Удаляем таблицы в обратном порядке
    op.drop_index(op.f('ix_biography_category_limits_biography_id'), table_name='biography_category_limits')
    op.drop_index(op.f('ix_biography_category_limits_id'), table_name='biography_category_limits')
    op.drop_table('biography_category_limits')
    
    op.drop_index(op.f('ix_questionnaire_responses_biography_id'), table_name='questionnaire_responses')
    op.drop_index(op.f('ix_questionnaire_responses_id'), table_name='questionnaire_responses')
    op.drop_table('questionnaire_responses')
    
    op.drop_index(op.f('ix_biographies_user_id'), table_name='biographies')
    op.drop_index(op.f('ix_biographies_id'), table_name='biographies')
    op.drop_table('biographies')
    
    # Удаляем поле new_user из таблицы users
    op.drop_column('users', 'new_user')

