"""Add non-citizen fields to users table"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add non-citizen fields
    op.add_column('users', sa.Column('citizenship_status', sa.String(20), server_default='CITIZEN', nullable=False))
    op.add_column('users', sa.Column('passport_number', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('refugee_id', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('permit_number', sa.String(30), nullable=True))
    op.add_column('users', sa.Column('country_of_origin', sa.String(50), nullable=True))
    
    # Add indexes
    op.create_index('idx_passport_number', 'users', ['passport_number'], unique=True, postgresql_where=sa.text('passport_number IS NOT NULL'))
    op.create_index('idx_refugee_id', 'users', ['refugee_id'], unique=True, postgresql_where=sa.text('refugee_id IS NOT NULL'))
    
    # Make omang nullable for non-citizens
    op.alter_column('users', 'omang', existing_type=sa.String(11), nullable=True)

def downgrade():
    op.drop_index('idx_refugee_id', table_name='users')
    op.drop_index('idx_passport_number', table_name='users')
    op.drop_column('users', 'country_of_origin')
    op.drop_column('users', 'permit_number')
    op.drop_column('users', 'refugee_id')
    op.drop_column('users', 'passport_number')
    op.drop_column('users', 'citizenship_status')
    op.alter_column('users', 'omang', existing_type=sa.String(11), nullable=False)