"""Add check-in and reschedule tables"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

def upgrade():
    # Create check_ins table
    op.create_table('check_ins',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('appointment_id', sa.Integer, sa.ForeignKey('appointments.id'), unique=True, nullable=False),
        sa.Column('patient_id', sa.Integer, sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('checked_in_by', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('checked_in_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('arrival_time', sa.DateTime, nullable=False),
        sa.Column('waiting_number', sa.String(20), nullable=False),
        sa.Column('vitals_recorded', sa.Boolean, default=False),
        sa.Column('vitals', JSON, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), default='WAITING')
    )
    
    # Create reschedule_requests table
    op.create_table('reschedule_requests',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('appointment_id', sa.Integer, sa.ForeignKey('appointments.id'), nullable=False),
        sa.Column('requested_by', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('requested_date', sa.DateTime, nullable=True),
        sa.Column('reason', sa.Text, nullable=False),
        sa.Column('status', sa.String(20), default='PENDING'),
        sa.Column('processed_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('processed_at', sa.DateTime, nullable=True),
        sa.Column('nurse_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now())
    )
    
    # Add indexes
    op.create_index('idx_checkins_appointment', 'check_ins', ['appointment_id'])
    op.create_index('idx_checkins_status', 'check_ins', ['status'])
    op.create_index('idx_checkins_waiting_number', 'check_ins', ['waiting_number'])
    op.create_index('idx_reschedule_status', 'reschedule_requests', ['status'])
    op.create_index('idx_reschedule_appointment', 'reschedule_requests', ['appointment_id'])

def downgrade():
    op.drop_table('reschedule_requests')
    op.drop_table('check_ins')