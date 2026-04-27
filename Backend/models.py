from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from datetime import datetime, timedelta
import uuid
import bcrypt
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET, ENUM as PG_ENUM
from sqlalchemy import Index, text

db = SQLAlchemy()
jwt = JWTManager()

# ==================== ENUMS (as strings for SQLAlchemy) ====================

class UserRole:
    PATIENT = 'patient'
    HEAD_NURSE = 'head_nurse'
    SPECIALIST = 'specialist'
    ADMIN = 'admin'

class UserStatus:
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    SUSPENDED = 'suspended'
    PENDING = 'pending'

class GenderType:
    MALE = 'male'
    FEMALE = 'female'
    OTHER = 'other'

class FacilityType:
    PRIMARY = 'primary'
    DISTRICT = 'district'
    REFERRAL = 'referral'
    CLINIC = 'clinic'
    PRIVATE = 'private'   # ADDED

class ReferralPriority:
    EMERGENCY = 'emergency'
    URGENT = 'urgent'
    ROUTINE = 'routine'

class ReferralStatus:
    PENDING = 'pending'
    PENDING_APPROVAL = 'pending_approval'
    ASSIGNED = 'assigned'
    SCHEDULED = 'scheduled'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'
    REJECTED = 'rejected'

class AppointmentStatus:
    SCHEDULED = 'scheduled'
    CONFIRMED = 'confirmed'
    CHECKED_IN = 'checked_in'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    MISSED = 'missed'
    CANCELLED = 'cancelled'
    RESCHEDULED = 'rescheduled'

class RescheduleStatus:
    PENDING = 'pending'
    APPROVED = 'approved'
    DENIED = 'denied'

class NotificationType:
    APPOINTMENT_REMINDER = 'appointment_reminder'
    APPOINTMENT_SCHEDULED = 'appointment_scheduled'
    APPOINTMENT_CANCELLED = 'appointment_cancelled'
    APPOINTMENT_RESCHEDULED = 'appointment_rescheduled'
    REFERRAL_RECEIVED = 'referral_received'
    REFERRAL_ASSIGNED = 'referral_assigned'
    REFERRAL_VIEWED = 'referral_viewed'
    RESCHEDULE_REQUEST = 'reschedule_request'
    RESCHEDULE_APPROVED = 'reschedule_approved'
    RESCHEDULE_DENIED = 'reschedule_denied'
    PIN_RESET = 'pin_reset'
    SYSTEM_ALERT = 'system_alert'
    USER_CREATED = 'user_created'
    USER_UPDATED = 'user_updated'
    USER_DELETED = 'user_deleted'
    SYSTEM_MAINTENANCE = 'system_maintenance'
    PATIENT_CHECKED_IN = 'patient_checked_in'
    TELEMEDICINE_SESSION = 'telemedicine_session'
    ESCALATION_ALERT = 'escalation_alert'

class DocumentType:
    REFERRAL_LETTER_INITIAL = 'referral_letter_initial'
    REFERRAL_LETTER_UPDATED = 'referral_letter_updated'
    CONSULTANT_REPORT = 'consultant_report'
    DISCHARGE_SUMMARY = 'discharge_summary'
    INVESTIGATION_RESULTS = 'investigation_results'
    CLINICAL_NOTES = 'clinical_notes'
    PATIENT_CONSENT_FORM = 'patient_consent_form'
    OTHER = 'other'

# ==================== SQLAlchemy ENUMs for PostgreSQL ====================

appointment_status_enum = PG_ENUM(
    'scheduled', 'confirmed', 'checked_in', 'in_progress',
    'completed', 'missed', 'cancelled', 'rescheduled',
    name='appointment_status', create_type=False
)

referral_status_enum = PG_ENUM(
    'pending', 'pending_approval', 'assigned', 'scheduled', 'completed', 'cancelled', 'rejected',
    name='referral_status', create_type=False
)

referral_priority_enum = PG_ENUM(
    'emergency', 'urgent', 'routine',
    name='referral_priority', create_type=False
)

reschedule_status_enum = PG_ENUM(
    'pending', 'approved', 'denied',
    name='reschedule_status', create_type=False
)

user_role_enum = PG_ENUM(
    'patient', 'head_nurse', 'specialist', 'admin',
    name='user_role', create_type=False
)

user_status_enum = PG_ENUM(
    'active', 'inactive', 'suspended', 'pending',
    name='user_status', create_type=False
)

gender_type_enum = PG_ENUM(
    'male', 'female', 'other',
    name='gender_type', create_type=False
)

facility_type_enum = PG_ENUM(
    'primary', 'district', 'referral', 'clinic', 'private',
    name='facility_type', create_type=False
)

notification_type_enum = PG_ENUM(
    'appointment_reminder', 'appointment_scheduled', 'appointment_cancelled',
    'appointment_rescheduled', 'referral_received', 'referral_assigned',
    'referral_viewed', 'reschedule_request', 'reschedule_approved',
    'reschedule_denied', 'pin_reset', 'system_alert', 'user_created',
    'user_updated', 'user_deleted', 'system_maintenance', 'patient_checked_in',
    'telemedicine_session', 'escalation_alert',
    name='notification_type', create_type=False
)

document_type_enum = PG_ENUM(
    'referral_letter_initial', 'referral_letter_updated', 'consultant_report',
    'discharge_summary', 'investigation_results', 'clinical_notes',
    'patient_consent_form', 'other',
    name='document_type', create_type=False
)

# ==================== MODELS ====================

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    omang = db.Column(db.String(20), unique=True, nullable=True)
    pin_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(user_role_enum, nullable=False)
    gender = db.Column(gender_type_enum)
    phone = db.Column(db.String(15))
    email = db.Column(db.String(100))
    status = db.Column(user_status_enum, default='active')
    
    pin_reset_token = db.Column(UUID(as_uuid=True), unique=True)
    pin_reset_expires_at = db.Column(db.DateTime)
    
    last_login_at = db.Column(db.DateTime)
    login_count = db.Column(db.Integer, default=0)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    
    employee_id = db.Column(db.String(50), unique=True)
    department = db.Column(db.String(100))
    job_title = db.Column(db.String(100))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    patient = db.relationship('Patient', back_populates='user', uselist=False, foreign_keys='Patient.user_id')
    nurse = db.relationship('Nurse', back_populates='user', uselist=False, foreign_keys='Nurse.user_id')
    specialist = db.relationship('Specialist', back_populates='user', uselist=False, foreign_keys='Specialist.user_id')
    notifications = db.relationship('Notification', back_populates='user', lazy='dynamic', foreign_keys='Notification.user_id')
    activity_logs = db.relationship('UserActivityLog', back_populates='user', lazy='dynamic', foreign_keys='UserActivityLog.user_id')
    sessions = db.relationship('UserSession', back_populates='user', lazy='dynamic', foreign_keys='UserSession.user_id')
    
    __table_args__ = (
        Index('idx_users_omang', 'omang'),
        Index('idx_users_role', 'role'),
        Index('idx_users_status', 'status'),
        Index('idx_users_email', 'email', postgresql_where=email.isnot(None)),
    )
    
    def set_pin(self, pin):
        salt = bcrypt.gensalt()
        self.pin_hash = bcrypt.hashpw(pin.encode('utf-8'), salt).decode('utf-8')
    
    def check_pin(self, pin):
        return bcrypt.checkpw(pin.encode('utf-8'), self.pin_hash.encode('utf-8'))
    
    def generate_pin_reset_token(self):
        self.pin_reset_token = uuid.uuid4()
        self.pin_reset_expires_at = datetime.utcnow() + timedelta(hours=24)
        return self.pin_reset_token
    
    def to_dict(self):
        return {
            'id': self.id,
            'uuid': str(self.uuid),
            'omang': self.omang,
            'full_name': self.full_name,
            'role': self.role,
            'gender': self.gender,
            'phone': self.phone,
            'email': self.email,
            'status': self.status,
            'employee_id': self.employee_id,
            'department': self.department,
            'job_title': self.job_title,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Facility(db.Model):
    __tablename__ = 'facilities'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(facility_type_enum, nullable=False)
    code = db.Column(db.String(20), unique=True)
    branch_number = db.Column(db.String(20), unique=True)
    village = db.Column(db.String(50))
    district = db.Column(db.String(50))
    address = db.Column(db.Text)
    phone = db.Column(db.String(15))
    email = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'uuid': str(self.uuid),
            'name': self.name,
            'type': self.type,
            'code': self.code,
            'branch_number': self.branch_number,
            'village': self.village,
            'district': self.district,
            'phone': self.phone,
            'email': self.email
        }

class Department(db.Model):
    __tablename__ = 'departments'
    
    id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code
        }

class Specialty(db.Model):
    __tablename__ = 'specialties'
    
    id = db.Column(db.BigInteger, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    consultation_duration = db.Column(db.Integer, default=30)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    specialists = db.relationship('Specialist', back_populates='specialty_rel', lazy='dynamic')

class Nurse(db.Model):
    __tablename__ = 'nurses'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    employee_id = db.Column(db.String(50), unique=True)
    facility_id = db.Column(db.BigInteger, db.ForeignKey('facilities.id'))
    department_id = db.Column(db.BigInteger, db.ForeignKey('departments.id'), nullable=False)
    qualification = db.Column(db.String(200))
    years_experience = db.Column(db.Integer)
    license_number = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    user = db.relationship('User', back_populates='nurse', foreign_keys=[user_id])
    facility = db.relationship('Facility', foreign_keys=[facility_id])
    department = db.relationship('Department', foreign_keys=[department_id])
    referrals_created = db.relationship('Referral', back_populates='referring_nurse', lazy='dynamic', foreign_keys='Referral.referring_nurse_id')
    check_ins = db.relationship('Appointment', back_populates='check_in_nurse', foreign_keys='Appointment.checked_in_by')
    
    __table_args__ = (
        Index('idx_nurses_facility', 'facility_id'),
        Index('idx_nurses_department', 'department_id'),
    )

class Specialist(db.Model):
    __tablename__ = 'specialists'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    employee_id = db.Column(db.String(50), unique=True)
    specialty_id = db.Column(db.BigInteger, db.ForeignKey('specialties.id'), nullable=False)
    sub_specialty = db.Column(db.String(100))
    facility_id = db.Column(db.BigInteger, db.ForeignKey('facilities.id'))
    department = db.Column(db.String(100))
    qualifications = db.Column(db.Text)
    years_experience = db.Column(db.Integer)
    license_number = db.Column(db.String(50))
    registration_council = db.Column(db.String(100))
    consultation_duration = db.Column(db.Integer)
    max_patients_per_day = db.Column(db.Integer, default=15)
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    user = db.relationship('User', back_populates='specialist', foreign_keys=[user_id])
    specialty_rel = db.relationship('Specialty', back_populates='specialists', foreign_keys=[specialty_id])
    facility = db.relationship('Facility', foreign_keys=[facility_id])
    referrals = db.relationship('Referral', back_populates='assigned_specialist', lazy='dynamic', foreign_keys='Referral.assigned_specialist_id')
    appointments = db.relationship('Appointment', back_populates='specialist_rel', lazy='dynamic', foreign_keys='Appointment.specialist_id')
    schedules = db.relationship('SpecialistSchedule', back_populates='specialist', lazy='dynamic', foreign_keys='SpecialistSchedule.specialist_id')
    
    __table_args__ = (
        Index('idx_specialists_specialty', 'specialty_id'),
        Index('idx_specialists_facility', 'facility_id'),
    )

class SpecialistSchedule(db.Model):
    __tablename__ = 'specialist_schedules'
    
    id = db.Column(db.BigInteger, primary_key=True)
    specialist_id = db.Column(db.BigInteger, db.ForeignKey('specialists.id', ondelete='CASCADE'), nullable=False)
    day_of_week = db.Column(db.SmallInteger, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    max_patients = db.Column(db.Integer, default=10)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    specialist = db.relationship('Specialist', back_populates='schedules', foreign_keys=[specialist_id])
    
    __table_args__ = (
        Index('idx_specialist_schedules', 'specialist_id', 'day_of_week'),
    )

class Patient(db.Model):
    __tablename__ = 'patients'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    omang = db.Column(db.String(20), unique=True, nullable=True)
    passport_number = db.Column(db.String(50), unique=True, nullable=True)
    national_patient_id = db.Column(db.String(50), unique=True, nullable=True)
    
    date_of_birth = db.Column(db.Date)
    place_of_birth = db.Column(db.String(100))
    nationality = db.Column(db.String(50), default='Botswana')
    
    address = db.Column(db.Text)
    village = db.Column(db.String(50))
    district = db.Column(db.String(50))
    postal_code = db.Column(db.String(10))
    
    next_of_kin_name = db.Column(db.String(100))
    next_of_kin_relationship = db.Column(db.String(50))
    next_of_kin_phone = db.Column(db.String(15))
    next_of_kin_address = db.Column(db.Text)
    
    medical_aid_number = db.Column(db.String(50))
    medical_aid_name = db.Column(db.String(100))
    medical_aid_status = db.Column(db.String(20))
    
    preferred_facility_id = db.Column(db.BigInteger, db.ForeignKey('facilities.id'))
    department_id = db.Column(db.BigInteger, db.ForeignKey('departments.id'))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    user = db.relationship('User', back_populates='patient', foreign_keys=[user_id])
    preferred_facility = db.relationship('Facility', foreign_keys=[preferred_facility_id])
    department = db.relationship('Department', foreign_keys=[department_id])
    referrals = db.relationship('Referral', back_populates='patient_rel', lazy='dynamic', foreign_keys='Referral.patient_id')
    appointments = db.relationship('Appointment', back_populates='patient_rel', lazy='dynamic', foreign_keys='Appointment.patient_id')
    medical_history = db.relationship('PatientMedicalHistory', back_populates='patient', lazy='dynamic', foreign_keys='PatientMedicalHistory.patient_id')
    reschedule_requests = db.relationship('RescheduleRequest', back_populates='patient', lazy='dynamic', foreign_keys='RescheduleRequest.patient_id')
    vital_readings = db.relationship('VitalReading', back_populates='patient', lazy='dynamic', foreign_keys='VitalReading.patient_id')
    
    __table_args__ = (
        Index('idx_patients_omang', 'omang'),
        Index('idx_patients_passport', 'passport_number'),
        Index('idx_patients_national_id', 'national_patient_id'),
        Index('idx_patients_department', 'department_id'),
        Index('idx_patients_district', 'district'),
        Index('idx_patients_village', 'village'),
    )

class PatientMedicalHistory(db.Model):
    __tablename__ = 'patient_medical_history'
    
    id = db.Column(db.BigInteger, primary_key=True)
    patient_id = db.Column(db.BigInteger, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    condition = db.Column(db.String(200))
    diagnosis_date = db.Column(db.Date)
    notes = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    patient = db.relationship('Patient', back_populates='medical_history', foreign_keys=[patient_id])
    
    __table_args__ = (
        Index('idx_patient_medical_history', 'patient_id'),
    )

class Referral(db.Model):
    __tablename__ = 'referrals'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    referral_number = db.Column(db.String(50), unique=True, nullable=False)
    
    patient_id = db.Column(db.BigInteger, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    referring_nurse_id = db.Column(db.BigInteger, db.ForeignKey('nurses.id'), nullable=False)
    assigned_specialist_id = db.Column(db.BigInteger, db.ForeignKey('specialists.id'))
    
    referring_facility_id = db.Column(db.BigInteger, db.ForeignKey('facilities.id'), nullable=False)
    referred_to_facility_id = db.Column(db.BigInteger, db.ForeignKey('facilities.id'), nullable=False)
    
    reason = db.Column(db.Text, nullable=False)
    clinical_summary = db.Column(db.Text)
    diagnosis = db.Column(db.String(500))
    symptoms = db.Column(db.Text)
    duration_of_condition = db.Column(db.String(100))
    previous_treatment = db.Column(db.Text)
    
    priority = db.Column(referral_priority_enum, default='routine')
    status = db.Column(referral_status_enum, default='pending', index=True)
    
    icd_10_code = db.Column(db.String(20))
    snomed_ct_code = db.Column(db.String(50))
    
    viewed_by_specialist = db.Column(db.Boolean, default=False)
    viewed_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)
    cancellation_reason = db.Column(db.Text)
    
    ubrn = db.Column(db.String(12), unique=True)
    source_referral = db.Column(db.String(100))
    
    approved_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    patient_rel = db.relationship('Patient', back_populates='referrals', foreign_keys=[patient_id])
    referring_nurse = db.relationship('Nurse', back_populates='referrals_created', foreign_keys=[referring_nurse_id])
    assigned_specialist = db.relationship('Specialist', back_populates='referrals', foreign_keys=[assigned_specialist_id])
    referring_facility = db.relationship('Facility', foreign_keys=[referring_facility_id])
    referred_facility = db.relationship('Facility', foreign_keys=[referred_to_facility_id])
    documents = db.relationship('ReferralDocument', back_populates='referral', lazy='dynamic', foreign_keys='ReferralDocument.referral_id')
    appointment = db.relationship('Appointment', back_populates='referral_rel', uselist=False, foreign_keys='Appointment.referral_id')
    ai_analysis = db.relationship('ReferralAIAnalysis', back_populates='referral', uselist=False, foreign_keys='ReferralAIAnalysis.referral_id')
    escalations = db.relationship('EscalationLog', back_populates='referral', lazy='dynamic', foreign_keys='EscalationLog.referral_id')
    
    __table_args__ = (
        Index('idx_referrals_patient', 'patient_id'),
        Index('idx_referrals_specialist', 'assigned_specialist_id'),
        Index('idx_referrals_status', 'status'),
        Index('idx_referrals_priority', 'priority'),
        Index('idx_referrals_ubrn', 'ubrn'),
    )

class ReferralDocument(db.Model):
    __tablename__ = 'referral_documents'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    referral_id = db.Column(db.BigInteger, db.ForeignKey('referrals.id', ondelete='CASCADE'), nullable=True)
    document_type = db.Column(document_type_enum, default='referral_letter_initial')
    
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.BigInteger)
    mime_type = db.Column(db.String(100))
    hash_sha256 = db.Column(db.String(64))
    
    version = db.Column(db.Integer, default=1)
    is_latest_version = db.Column(db.Boolean, default=True)
    
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    document_date = db.Column(db.Date)
    author_name = db.Column(db.String(100))
    author_role = db.Column(db.String(50))
    
    is_confidential = db.Column(db.Boolean, default=True)
    is_archived = db.Column(db.Boolean, default=False)
    
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    last_accessed_at = db.Column(db.DateTime)
    access_count = db.Column(db.Integer, default=0)
    
    ocr_text = db.Column(db.Text)
    
    referral = db.relationship('Referral', back_populates='documents', foreign_keys=[referral_id])
    uploader = db.relationship('User', foreign_keys=[uploaded_by])
    
    __table_args__ = (
        Index('idx_referral_documents_referral', 'referral_id'),
        Index('idx_referral_documents_type', 'document_type'),
    )

class Appointment(db.Model):
    __tablename__ = 'appointments'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    appointment_number = db.Column(db.String(50), unique=True, nullable=False)
    
    referral_id = db.Column(db.BigInteger, db.ForeignKey('referrals.id', ondelete='CASCADE'), nullable=False, unique=True)
    patient_id = db.Column(db.BigInteger, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    specialist_id = db.Column(db.BigInteger, db.ForeignKey('specialists.id', ondelete='CASCADE'), nullable=False)
    
    appointment_date = db.Column(db.DateTime, nullable=False, index=True)
    duration = db.Column(db.Integer, default=30)
    end_time = db.Column(db.DateTime)
    
    status = db.Column(appointment_status_enum, default='scheduled', index=True)
    
    checked_in = db.Column(db.Boolean, default=False)
    checked_in_at = db.Column(db.DateTime)
    checked_in_by = db.Column(db.BigInteger, db.ForeignKey('nurses.id'))
    
    outcome = db.Column(db.Text)
    clinical_notes = db.Column(db.Text)
    
    reminder_sent = db.Column(db.Boolean, default=False)
    reminder_sent_at = db.Column(db.DateTime)
    sms_reminder_sent = db.Column(db.Boolean, default=False)
    sms_reminder_sent_at = db.Column(db.DateTime)
    
    is_telemedicine = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    referral_rel = db.relationship('Referral', back_populates='appointment', foreign_keys=[referral_id])
    patient_rel = db.relationship('Patient', back_populates='appointments', foreign_keys=[patient_id])
    specialist_rel = db.relationship('Specialist', back_populates='appointments', foreign_keys=[specialist_id])
    check_in_nurse = db.relationship('Nurse', back_populates='check_ins', foreign_keys=[checked_in_by])
    reschedule_requests = db.relationship('RescheduleRequest', back_populates='appointment', lazy='dynamic', foreign_keys='RescheduleRequest.appointment_id')
    telemedicine_session = db.relationship('TelemedicineSession', back_populates='appointment', uselist=False, foreign_keys='TelemedicineSession.appointment_id')
    
    __table_args__ = (
        Index('idx_appointments_patient', 'patient_id'),
        Index('idx_appointments_specialist', 'specialist_id'),
        Index('idx_appointments_date', 'appointment_date'),
        Index('idx_appointments_status', 'status'),
    )

class RescheduleRequest(db.Model):
    __tablename__ = 'reschedule_requests'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    request_number = db.Column(db.String(50), unique=True, nullable=False)
    
    appointment_id = db.Column(db.BigInteger, db.ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False)
    patient_id = db.Column(db.BigInteger, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    
    reason = db.Column(db.Text, nullable=False)
    requested_date = db.Column(db.DateTime)
    additional_notes = db.Column(db.Text)
    
    status = db.Column(reschedule_status_enum, default='pending')
    
    reviewed_by = db.Column(db.BigInteger, db.ForeignKey('nurses.id'))
    reviewed_at = db.Column(db.DateTime)
    review_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    appointment = db.relationship('Appointment', back_populates='reschedule_requests', foreign_keys=[appointment_id])
    patient = db.relationship('Patient', back_populates='reschedule_requests', foreign_keys=[patient_id])
    reviewer = db.relationship('Nurse', foreign_keys=[reviewed_by])
    
    __table_args__ = (
        Index('idx_reschedule_requests_appointment', 'appointment_id'),
        Index('idx_reschedule_requests_status', 'status'),
    )

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    type = db.Column(notification_type_enum, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    data = db.Column(JSONB)
    
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    user = db.relationship('User', back_populates='notifications', foreign_keys=[user_id])
    
    __table_args__ = (
        Index('idx_notifications_user', 'user_id'),
    )

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    user_role = db.Column(user_role_enum)
    user_omang = db.Column(db.String(20))
    
    action = db.Column(db.String(50), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)
    resource_id = db.Column(db.BigInteger)
    resource_uuid = db.Column(UUID(as_uuid=True))
    
    old_values = db.Column(JSONB)
    new_values = db.Column(JSONB)
    changes = db.Column(JSONB)
    
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.Text)
    session_id = db.Column(db.String(100))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

class Report(db.Model):
    __tablename__ = 'reports'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    report_number = db.Column(db.String(50), unique=True, nullable=False)
    
    report_type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    
    parameters = db.Column(JSONB, nullable=False)
    data = db.Column(JSONB, nullable=False)
    
    format = db.Column(db.String(10), default='json')
    exported_at = db.Column(db.DateTime)
    export_path = db.Column(db.String(500))
    
    generated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    is_scheduled = db.Column(db.Boolean, default=False)
    schedule_cron = db.Column(db.String(100))
    last_run_at = db.Column(db.DateTime)
    next_run_at = db.Column(db.DateTime)

# ==================== ADMIN MODELS ====================

class UserActivityLog(db.Model):
    __tablename__ = 'user_activity_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_full_name = db.Column(db.String(100))
    user_role = db.Column(user_role_enum)
    action_type = db.Column(db.String(50), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)
    resource_id = db.Column(db.BigInteger)
    resource_details = db.Column(JSONB)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.Text)
    performed_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='success')
    
    user = db.relationship('User', back_populates='activity_logs', foreign_keys=[user_id])
    
    __table_args__ = (
        Index('idx_user_activity_user', 'user_id'),
        Index('idx_user_activity_type', 'action_type'),
        Index('idx_user_activity_performed_at', 'performed_at'),
    )
    
    @classmethod
    def log_action(cls, user_id, action_type, resource_type, resource_id=None, 
                   resource_details=None, ip_address=None, user_agent=None, status='success'):
        user = User.query.get(user_id)
        log = cls(
            user_id=user_id,
            user_full_name=user.full_name if user else None,
            user_role=user.role if user else None,
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_details=resource_details,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status
        )
        db.session.add(log)
        db.session.commit()
        return log

class SystemConfig(db.Model):
    __tablename__ = 'system_config'
    
    id = db.Column(db.BigInteger, primary_key=True)
    config_key = db.Column(db.String(100), unique=True, nullable=False)
    config_value = db.Column(db.Text)
    config_type = db.Column(db.String(20), default='string')
    description = db.Column(db.Text)
    is_editable = db.Column(db.Boolean, default=True)
    updated_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    updater = db.relationship('User', foreign_keys=[updated_by])
    
    @classmethod
    def get(cls, key, default=None):
        config = cls.query.filter_by(config_key=key).first()
        if not config:
            return default
        if config.config_type == 'integer':
            return int(config.config_value)
        elif config.config_type == 'boolean':
            return config.config_value.lower() == 'true'
        elif config.config_type == 'json':
            import json
            return json.loads(config.config_value)
        else:
            return config.config_value
    
    @classmethod
    def set(cls, key, value, updated_by=None):
        config = cls.query.filter_by(config_key=key).first()
        if not config:
            config = cls(config_key=key, config_value=str(value))
            db.session.add(config)
        else:
            config.config_value = str(value)
            config.updated_by = updated_by
            config.updated_at = datetime.utcnow()
        db.session.commit()
        return config

class UserSession(db.Model):
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    session_token = db.Column(db.String(255), unique=True, nullable=False)
    login_time = db.Column(db.DateTime, default=datetime.utcnow)
    logout_time = db.Column(db.DateTime)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    duration_seconds = db.Column(db.Integer)
    
    user = db.relationship('User', back_populates='sessions', foreign_keys=[user_id])
    
    __table_args__ = (
        Index('idx_user_sessions_user', 'user_id'),
        Index('idx_user_sessions_active', 'is_active'),
    )

class SystemMetric(db.Model):
    __tablename__ = 'system_metrics'
    
    id = db.Column(db.BigInteger, primary_key=True)
    metric_name = db.Column(db.String(100), nullable=False)
    metric_value = db.Column(db.Numeric)
    metric_unit = db.Column(db.String(20))
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_system_metrics_name', 'metric_name'),
        Index('idx_system_metrics_recorded', 'recorded_at'),
    )


# ==================== NEW RESEARCH-BACKED MODELS ====================

class TelemedicineSession(db.Model):
    __tablename__ = 'telemedicine_sessions'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    appointment_id = db.Column(db.BigInteger, db.ForeignKey('appointments.id'), nullable=False)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    room_name = db.Column(db.String(100), nullable=False)
    room_url = db.Column(db.String(500), nullable=False)
    specialist_join_url = db.Column(db.String(500))
    patient_join_url = db.Column(db.String(500))
    meeting_password = db.Column(db.String(50))
    status = db.Column(db.String(20), default='scheduled')  # scheduled, active, completed, cancelled
    scheduled_start = db.Column(db.DateTime, nullable=False)
    scheduled_end = db.Column(db.DateTime)
    started_at = db.Column(db.DateTime)
    ended_at = db.Column(db.DateTime)
    recording_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    appointment = db.relationship('Appointment', back_populates='telemedicine_session', foreign_keys=[appointment_id])
    
    __table_args__ = (
        Index('idx_telemedicine_appointment', 'appointment_id'),
        Index('idx_telemedicine_status', 'status'),
    )


class VitalReading(db.Model):
    __tablename__ = 'vital_readings'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    patient_id = db.Column(db.BigInteger, db.ForeignKey('patients.id'), nullable=False)
    recorded_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)
    source = db.Column(db.String(20), default='manual')  # manual, device, telemedicine
    
    # Vitals as JSON for flexible storage
    vitals = db.Column(JSONB, nullable=False)
    
    # Individual fields for quick querying
    temperature = db.Column(db.Numeric(4, 1))
    heart_rate = db.Column(db.Integer)
    blood_pressure_systolic = db.Column(db.Integer)
    blood_pressure_diastolic = db.Column(db.Integer)
    respiratory_rate = db.Column(db.Integer)
    oxygen_saturation = db.Column(db.Integer)
    blood_glucose = db.Column(db.Integer)
    weight = db.Column(db.Numeric(6, 2))
    
    notes = db.Column(db.Text)
    is_abnormal = db.Column(db.Boolean, default=False)
    alert_sent = db.Column(db.Boolean, default=False)
    
    patient = db.relationship('Patient', back_populates='vital_readings', foreign_keys=[patient_id])
    recorder = db.relationship('User', foreign_keys=[recorded_by])
    
    __table_args__ = (
        Index('idx_vitals_patient', 'patient_id'),
        Index('idx_vitals_recorded_at', 'recorded_at'),
        Index('idx_vitals_abnormal', 'is_abnormal'),
    )


class EscalationLog(db.Model):
    __tablename__ = 'escalation_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    referral_id = db.Column(db.BigInteger, db.ForeignKey('referrals.id'), nullable=False)
    escalation_level = db.Column(db.String(50), nullable=False)  # nurse_alert, department_head, hospital_admin
    triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    waiting_days_at_trigger = db.Column(db.Integer)
    notification_sent = db.Column(db.Boolean, default=True)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    resolution_notes = db.Column(db.Text)
    
    referral = db.relationship('Referral', back_populates='escalations', foreign_keys=[referral_id])
    resolver = db.relationship('User', foreign_keys=[resolved_by])
    
    __table_args__ = (
        Index('idx_escalation_referral', 'referral_id'),
        Index('idx_escalation_level', 'escalation_level'),
        Index('idx_escalation_resolved', 'resolved_at'),
    )


class ReferralAIAnalysis(db.Model):
    __tablename__ = 'referral_ai_analyses'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    referral_id = db.Column(db.BigInteger, db.ForeignKey('referrals.id'), nullable=False, unique=True)
    
    # AI analysis results
    completeness_score = db.Column(db.Numeric(5, 2))
    missing_fields = db.Column(JSONB)
    specialty_match = db.Column(JSONB)
    recommendations = db.Column(JSONB)
    suggested_priority = db.Column(db.String(20))
    urgency_indicators = db.Column(JSONB)
    
    # No-show prediction
    no_show_risk_score = db.Column(db.Numeric(5, 3))
    no_show_risk_level = db.Column(db.String(10))
    no_show_factors = db.Column(JSONB)
    no_show_recommendation = db.Column(JSONB)
    
    analyzed_at = db.Column(db.DateTime, default=datetime.utcnow)
    analyzed_by = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    
    referral = db.relationship('Referral', back_populates='ai_analysis', foreign_keys=[referral_id])
    analyzer = db.relationship('User', foreign_keys=[analyzed_by])
    
    __table_args__ = (
        Index('idx_ai_referral', 'referral_id'),
        Index('idx_ai_score', 'completeness_score'),
    )


class FHIRTransactionLog(db.Model):
    __tablename__ = 'fhir_transaction_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)
    uuid = db.Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    transaction_id = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)
    resource_id = db.Column(db.String(100))
    operation = db.Column(db.String(20))  # create, read, update, delete
    request_payload = db.Column(JSONB)
    response_payload = db.Column(JSONB)
    status_code = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')  # pending, success, failed
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    __table_args__ = (
        Index('idx_fhir_transaction', 'transaction_id'),
        Index('idx_fhir_resource', 'resource_type', 'resource_id'),
        Index('idx_fhir_status', 'status'),
    )


class AnalyticsCache(db.Model):
    __tablename__ = 'analytics_cache'
    
    id = db.Column(db.BigInteger, primary_key=True)
    cache_key = db.Column(db.String(255), unique=True, nullable=False)
    cache_data = db.Column(JSONB, nullable=False)
    report_type = db.Column(db.String(50))
    parameters = db.Column(JSONB)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    
    __table_args__ = (
        Index('idx_analytics_cache_key', 'cache_key'),
        Index('idx_analytics_expires', 'expires_at'),
    )