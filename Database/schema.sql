-- =====================================================
-- ISAS - COMPLETE DATABASE SCHEMA + SEED DATA
-- Includes all tables, indexes, triggers, and seed data.
-- Facility type includes 'private' for private hospitals.
-- Patient 599317711: Leteng Kevin Mpolokeng, letengkevinm@gmail.com
-- All Omang numbers are valid (9 digits, 5th digit 1 or 2).
-- Run this script ONCE in pgAdmin.
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- DROP EVERYTHING (clean slate)
-- =====================================================
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_activity_logs CASCADE;
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reschedule_requests CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS referral_documents CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS patient_medical_history CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS specialist_schedules CASCADE;
DROP TABLE IF EXISTS specialists CASCADE;
DROP TABLE IF EXISTS nurses CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS specialties CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS gender_type CASCADE;
DROP TYPE IF EXISTS facility_type CASCADE;
DROP TYPE IF EXISTS referral_priority CASCADE;
DROP TYPE IF EXISTS referral_status CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;
DROP TYPE IF EXISTS reschedule_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE user_role AS ENUM ('patient', 'head_nurse', 'specialist', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE facility_type AS ENUM ('primary', 'district', 'referral', 'clinic', 'private');
CREATE TYPE referral_priority AS ENUM ('emergency', 'urgent', 'routine');
CREATE TYPE referral_status AS ENUM ('pending', 'pending_approval', 'assigned', 'scheduled', 'completed', 'cancelled', 'rejected');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'missed', 'cancelled', 'rescheduled');
CREATE TYPE reschedule_status AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE notification_type AS ENUM (
    'appointment_reminder', 'appointment_scheduled', 'appointment_cancelled',
    'appointment_rescheduled', 'referral_received', 'referral_assigned',
    'referral_viewed', 'reschedule_request', 'reschedule_approved',
    'reschedule_denied', 'pin_reset', 'system_alert', 'user_created',
    'user_updated', 'user_deleted', 'system_maintenance', 'patient_checked_in'
);
CREATE TYPE document_type AS ENUM (
    'referral_letter_initial', 'referral_letter_updated', 'consultant_report',
    'discharge_summary', 'investigation_results', 'clinical_notes',
    'patient_consent_form', 'other'
);

-- =====================================================
-- CORE TABLES
-- =====================================================
CREATE TABLE specialties (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    consultation_duration INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE facilities (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    name VARCHAR(100) NOT NULL,
    type facility_type NOT NULL,
    code VARCHAR(20) UNIQUE,
    branch_number VARCHAR(20) UNIQUE,
    village VARCHAR(50),
    district VARCHAR(50),
    address TEXT,
    phone VARCHAR(15),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    omang VARCHAR(20) UNIQUE,
    pin_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    gender gender_type,
    phone VARCHAR(15),
    email VARCHAR(100),
    status user_status DEFAULT 'active',
    pin_reset_token UUID UNIQUE,
    pin_reset_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    job_title VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE nurses (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE,
    facility_id BIGINT REFERENCES facilities(id),
    department_id BIGINT NOT NULL REFERENCES departments(id),
    qualification VARCHAR(200),
    years_experience INTEGER,
    license_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE specialists (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE,
    specialty_id BIGINT NOT NULL REFERENCES specialties(id),
    sub_specialty VARCHAR(100),
    facility_id BIGINT REFERENCES facilities(id),
    department VARCHAR(100),
    qualifications TEXT,
    years_experience INTEGER,
    license_number VARCHAR(50),
    registration_council VARCHAR(100),
    consultation_duration INTEGER,
    max_patients_per_day INTEGER DEFAULT 15,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE specialist_schedules (
    id BIGSERIAL PRIMARY KEY,
    specialist_id BIGINT NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    omang VARCHAR(20) UNIQUE,
    passport_number VARCHAR(50) UNIQUE,
    national_patient_id VARCHAR(50) UNIQUE,
    date_of_birth DATE,
    place_of_birth VARCHAR(100),
    nationality VARCHAR(50) DEFAULT 'Botswana',
    address TEXT,
    village VARCHAR(50),
    district VARCHAR(50),
    postal_code VARCHAR(10),
    next_of_kin_name VARCHAR(100),
    next_of_kin_relationship VARCHAR(50),
    next_of_kin_phone VARCHAR(15),
    next_of_kin_address TEXT,
    medical_aid_number VARCHAR(50),
    medical_aid_name VARCHAR(100),
    medical_aid_status VARCHAR(20),
    preferred_facility_id BIGINT REFERENCES facilities(id),
    department_id BIGINT REFERENCES departments(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE patient_medical_history (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition VARCHAR(200),
    diagnosis_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id)
);

CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    referral_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    referring_nurse_id BIGINT NOT NULL REFERENCES nurses(id),
    assigned_specialist_id BIGINT REFERENCES specialists(id),
    referring_facility_id BIGINT NOT NULL REFERENCES facilities(id),
    referred_to_facility_id BIGINT NOT NULL REFERENCES facilities(id),
    reason TEXT NOT NULL,
    clinical_summary TEXT,
    diagnosis VARCHAR(500),
    symptoms TEXT,
    duration_of_condition VARCHAR(100),
    previous_treatment TEXT,
    priority referral_priority DEFAULT 'routine',
    status referral_status DEFAULT 'pending',
    icd_10_code VARCHAR(20),
    snomed_ct_code VARCHAR(50),
    viewed_by_specialist BOOLEAN DEFAULT false,
    viewed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    ubrn VARCHAR(12) UNIQUE,
    source_referral VARCHAR(100),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE referral_documents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    referral_id BIGINT REFERENCES referrals(id) ON DELETE CASCADE,
    document_type document_type DEFAULT 'referral_letter_initial',
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    hash_sha256 VARCHAR(64),
    version INTEGER DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT true,
    title VARCHAR(255),
    description TEXT,
    document_date DATE,
    author_name VARCHAR(100),
    author_role VARCHAR(50),
    is_confidential BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    uploaded_by BIGINT REFERENCES users(id),
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    ocr_text TEXT
);

CREATE TABLE appointments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    appointment_number VARCHAR(50) UNIQUE NOT NULL,
    referral_id BIGINT NOT NULL UNIQUE REFERENCES referrals(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id BIGINT NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
    appointment_date TIMESTAMPTZ NOT NULL,
    duration INTEGER DEFAULT 30,
    end_time TIMESTAMPTZ,
    status appointment_status DEFAULT 'scheduled',
    checked_in BOOLEAN DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    checked_in_by BIGINT REFERENCES nurses(id),
    outcome TEXT,
    clinical_notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMPTZ,
    sms_reminder_sent BOOLEAN DEFAULT false,
    sms_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE reschedule_requests (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    requested_date TIMESTAMPTZ,
    additional_notes TEXT,
    status reschedule_status DEFAULT 'pending',
    reviewed_by BIGINT REFERENCES nurses(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT REFERENCES users(id),
    user_role user_role,
    user_omang VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id BIGINT,
    resource_uuid UUID,
    old_values JSONB,
    new_values JSONB,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    report_number VARCHAR(50) UNIQUE NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL,
    data JSONB NOT NULL,
    format VARCHAR(10) DEFAULT 'json',
    exported_at TIMESTAMPTZ,
    export_path VARCHAR(500),
    generated_by BIGINT NOT NULL REFERENCES users(id),
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_scheduled BOOLEAN DEFAULT false,
    schedule_cron VARCHAR(100),
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ
);

-- =====================================================
-- ADMIN TABLES
-- =====================================================
CREATE TABLE user_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_full_name VARCHAR(100),
    user_role user_role,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id BIGINT,
    resource_details JSONB,
    ip_address INET,
    user_agent TEXT,
    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'success'
);

CREATE TABLE system_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_editable BOOLEAN DEFAULT true,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    login_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    duration_seconds INTEGER
);

CREATE TABLE system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_unit VARCHAR(20),
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_users_omang ON users(omang);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE INDEX idx_nurses_facility ON nurses(facility_id);
CREATE INDEX idx_nurses_department ON nurses(department_id);

CREATE INDEX idx_specialists_specialty ON specialists(specialty_id);
CREATE INDEX idx_specialists_facility ON specialists(facility_id);

CREATE INDEX idx_specialist_schedules ON specialist_schedules(specialist_id, day_of_week);

CREATE INDEX idx_patients_omang ON patients(omang);
CREATE INDEX idx_patients_department ON patients(department_id);

CREATE INDEX idx_referrals_patient ON referrals(patient_id);
CREATE INDEX idx_referrals_specialist ON referrals(assigned_specialist_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_priority ON referrals(priority);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_specialist ON appointments(specialist_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_user_activity_user ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_type ON user_activity_logs(action_type);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nurses_updated_at BEFORE UPDATE ON nurses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_specialists_updated_at BEFORE UPDATE ON specialists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reschedule_requests_updated_at BEFORE UPDATE ON reschedule_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto generate referral number
CREATE OR REPLACE FUNCTION generate_referral_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INTEGER;
BEGIN
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(referral_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM referrals
    WHERE referral_number LIKE 'REF-' || year_prefix || '-%';
    NEW.referral_number := 'REF-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_referral_number_trigger
    BEFORE INSERT ON referrals
    FOR EACH ROW
    WHEN (NEW.referral_number IS NULL)
    EXECUTE FUNCTION generate_referral_number();

-- Auto generate appointment number
CREATE OR REPLACE FUNCTION generate_appointment_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INTEGER;
BEGIN
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(appointment_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM appointments
    WHERE appointment_number LIKE 'APT-' || year_prefix || '-%';
    NEW.appointment_number := 'APT-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_appointment_number_trigger
    BEFORE INSERT ON appointments
    FOR EACH ROW
    WHEN (NEW.appointment_number IS NULL)
    EXECUTE FUNCTION generate_appointment_number();

-- Auto generate reschedule request number
CREATE OR REPLACE FUNCTION generate_reschedule_request_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INTEGER;
BEGIN
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM reschedule_requests
    WHERE request_number LIKE 'REQ-' || year_prefix || '-%';
    NEW.request_number := 'REQ-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_reschedule_request_number_trigger
    BEFORE INSERT ON reschedule_requests
    FOR EACH ROW
    WHEN (NEW.request_number IS NULL)
    EXECUTE FUNCTION generate_reschedule_request_number();

-- Conflict detection
CREATE OR REPLACE FUNCTION check_appointment_conflict()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE specialist_id = NEW.specialist_id
      AND status IN ('scheduled', 'confirmed')
      AND appointment_date < (NEW.appointment_date + (NEW.duration * INTERVAL '1 minute'))
      AND (appointment_date + (duration * INTERVAL '1 minute')) > NEW.appointment_date
      AND id != COALESCE(NEW.id, 0);
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Appointment conflict: specialist already has an appointment at this time';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_appointment_conflict_trigger
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    WHEN (NEW.status IN ('scheduled', 'confirmed'))
    EXECUTE FUNCTION check_appointment_conflict();

-- Auto calculate end_time
CREATE OR REPLACE FUNCTION calculate_appointment_end_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.end_time = NEW.appointment_date + (NEW.duration * INTERVAL '1 minute');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_appointment_end_time_trigger
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_appointment_end_time();

-- =====================================================
-- SEED DATA (Reference & Demo Accounts)
-- =====================================================

-- Specialties
INSERT INTO specialties (code, name, consultation_duration) VALUES
    ('CARD', 'Cardiology', 30),
    ('ONC', 'Oncology', 45),
    ('PED', 'Paediatrics', 30),
    ('ORTH', 'Orthopaedics', 30),
    ('NEURO', 'Neurology', 45),
    ('PSYCH', 'Psychiatry', 50),
    ('OBGYN', 'Obstetrics & Gynaecology', 30),
    ('OPHTH', 'Ophthalmology', 30),
    ('DERM', 'Dermatology', 30)
ON CONFLICT (code) DO NOTHING;

-- Facilities (including private hospitals)
INSERT INTO facilities (name, type, village, district, code, branch_number) VALUES
    ('Princess Marina Hospital', 'referral', 'Gaborone', 'Gaborone', 'PMH', 'PMH-001'),
    ('Nyangabwe Referral Hospital', 'referral', 'Francistown', 'Francistown', 'NRH', 'NRH-002'),
    ('Sbrana Psychiatric Hospital', 'referral', 'Lobatse', 'Lobatse', 'SPH', 'SPH-003'),
    ('Ghanzi Primary Hospital', 'primary', 'Ghanzi', 'Ghanzi', 'GPH', 'GPH-004'),
    ('Maun General Hospital', 'district', 'Maun', 'Ngamiland', 'MGH', 'MGH-005'),
    ('Scottish Livingstone Hospital', 'district', 'Molepolole', 'Kweneng', 'SLH', 'SLH-006'),
    ('Bokamoso Private Hospital', 'private', 'Gaborone', 'Gaborone', 'BOK', 'BOK-001'),
    ('Gaborone Private Hospital', 'private', 'Gaborone', 'Gaborone', 'GPH', 'GPH-001')
ON CONFLICT (code) DO NOTHING;

-- Departments
INSERT INTO departments (name, code) VALUES
    ('Cardiology', 'CARD'),
    ('Oncology', 'ONC'),
    ('Paediatrics', 'PED'),
    ('Orthopaedics', 'ORTH'),
    ('Neurology', 'NEURO'),
    ('Psychiatry', 'PSYCH'),
    ('Obstetrics & Gynaecology', 'OBGYN'),
    ('Ophthalmology', 'OPHTH'),
    ('Dermatology', 'DERM')
ON CONFLICT (code) DO NOTHING;

-- System Config
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
    ('max_login_attempts', '5', 'integer', 'Maximum failed login attempts before lockout'),
    ('session_timeout_minutes', '60', 'integer', 'User session timeout'),
    ('pin_reset_expiry_hours', '24', 'integer', 'PIN reset token expiry'),
    ('audit_log_retention_days', '90', 'integer', 'Audit log retention'),
    ('maintenance_mode', 'false', 'boolean', 'Maintenance mode flag'),
    ('require_strong_pin', 'true', 'boolean', 'Require complex PINs'),
    ('max_active_sessions', '1', 'integer', 'Max concurrent sessions per user'),
    ('notification_email', 'admin@isas.gov.bw', 'string', 'System notification email'),
    ('system_name', 'ISAS - Botswana', 'string', 'System display name'),
    ('data_backup_time', '02:00', 'string', 'Scheduled backup time'),
    ('pin_lock_duration_minutes', '30', 'integer', 'Account lock duration after max attempts')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- DEMO USERS (ALL with PIN 1234)
-- Valid Omang numbers (9 digits, 5th digit 1 or 2)
-- =====================================================

-- Admin user
INSERT INTO users (uuid, omang, pin_hash, full_name, role, gender, email, employee_id, job_title, status, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    '100010001',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy',
    'System Administrator',
    'admin',
    'male',
    'admin@isas.gov.bw',
    'ADMIN001',
    'System Administrator',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (omang) DO NOTHING;

-- Head Nurses
INSERT INTO users (uuid, omang, pin_hash, full_name, role, gender, phone, email, employee_id, department, status) VALUES
    (gen_random_uuid(), '599317701', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Mpho Nkosi', 'head_nurse', 'female', '71234567', 'mpho.nkosi@isas.bw', 'HN001', 'Cardiology', 'active'),
    (gen_random_uuid(), '599317702', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Tebogo Moatshe', 'head_nurse', 'female', '71234568', 'tebogo.moatshe@isas.bw', 'HN002', 'Oncology', 'active'),
    (gen_random_uuid(), '599317703', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Kefilwe Modise', 'head_nurse', 'female', '71234569', 'kefilwe.modise@isas.bw', 'HN003', 'Paediatrics', 'active'),
    (gen_random_uuid(), '599317704', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Boitumelo Sebego', 'head_nurse', 'female', '71234570', 'boitumelo.sebego@isas.bw', 'HN004', 'Orthopaedics', 'active'),
    (gen_random_uuid(), '599317705', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Gosego Moeng', 'head_nurse', 'female', '71234571', 'gosego.moeng@isas.bw', 'HN005', 'Neurology', 'active'),
    (gen_random_uuid(), '599317706', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Lorato Thapelo', 'head_nurse', 'female', '71234572', 'lorato.thapelo@isas.bw', 'HN006', 'Psychiatry', 'active'),
    (gen_random_uuid(), '599317707', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Masego Ketshabile', 'head_nurse', 'female', '71234573', 'masego.ketshabile@isas.bw', 'HN007', 'Obstetrics & Gynaecology', 'active'),
    (gen_random_uuid(), '599317708', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Olebogeng Moseki', 'head_nurse', 'female', '71234574', 'olebogeng.moseki@isas.bw', 'HN008', 'Ophthalmology', 'active'),
    (gen_random_uuid(), '599317709', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Tshepiso Moalosi', 'head_nurse', 'female', '71234575', 'tshepiso.moalosi@isas.bw', 'HN009', 'Dermatology', 'active')
ON CONFLICT (omang) DO NOTHING;

-- Specialists
INSERT INTO users (uuid, omang, pin_hash, full_name, role, gender, phone, email, employee_id, department, status) VALUES
    (gen_random_uuid(), '599317755', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'John Sebina', 'specialist', 'male', '71234580', 'john.sebina@isas.bw', 'SP001', 'Cardiology', 'active'),
    (gen_random_uuid(), '599327744', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Sharon Maiketso', 'specialist', 'female', '71234581', 'sharon.maiketso@isas.bw', 'SP002', 'Oncology', 'active'),
    (gen_random_uuid(), '599337733', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Kagiso Ndlovu', 'specialist', 'male', '71234582', 'kagiso.ndlovu@isas.bw', 'SP003', 'Paediatrics', 'active'),
    (gen_random_uuid(), '599347722', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Mpho Rakgomo', 'specialist', 'female', '71234583', 'mpho.rakgomo@isas.bw', 'SP004', 'Orthopaedics', 'active'),
    (gen_random_uuid(), '599357711', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Lentswe Moremi', 'specialist', 'male', '71234584', 'lentswe.moremi@isas.bw', 'SP005', 'Neurology', 'active'),
    (gen_random_uuid(), '599367700', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Tumelo Moepi', 'specialist', 'female', '71234585', 'tumelo.moepi@isas.bw', 'SP006', 'Psychiatry', 'active'),
    (gen_random_uuid(), '599377689', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Masego Nthoi', 'specialist', 'female', '71234586', 'masego.nthoi@isas.bw', 'SP007', 'Obstetrics & Gynaecology', 'active'),
    (gen_random_uuid(), '599387678', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Tshepo Mosarwa', 'specialist', 'male', '71234587', 'tshepo.mosarwa@isas.bw', 'SP008', 'Ophthalmology', 'active'),
    (gen_random_uuid(), '599397667', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Kgomotso Thamaga', 'specialist', 'female', '71234588', 'kgomotso.thamaga@isas.bw', 'SP009', 'Dermatology', 'active')
ON CONFLICT (omang) DO NOTHING;

-- Patients (citizens)
INSERT INTO users (uuid, omang, pin_hash, full_name, role, gender, phone, email, status) VALUES
    (gen_random_uuid(), '599317711', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Leteng Kevin Mpolokeng', 'patient', 'male', '71234567', 'letengkevinm@gmail.com', 'active'),
    (gen_random_uuid(), '599324411', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Lorato Kgosi', 'patient', 'female', '76789012', 'lorato@example.com', 'active'),
    (gen_random_uuid(), '599315522', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Kagiso Modise', 'patient', 'male', '73456789', 'kagiso@example.com', 'active'),
    (gen_random_uuid(), '599327788', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Boitumelo Ramatla', 'patient', 'female', '75678901', 'boitumelo@example.com', 'active'),
    (gen_random_uuid(), '599326677', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Keitumetse Ntseme', 'patient', 'female', '77890123', 'keitumetse@example.com', 'active'),
    (gen_random_uuid(), '599312233', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Tumelo Masire', 'patient', 'male', '74567890', 'tumelo@example.com', 'active')
ON CONFLICT (omang) DO NOTHING;

-- Additional patients
INSERT INTO users (uuid, omang, pin_hash, full_name, role, gender, phone, email, status) VALUES
    (gen_random_uuid(), '599318822', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Goitseone Motsumi', 'patient', 'female', '71345678', 'goitseone@example.com', 'active'),
    (gen_random_uuid(), '599319933', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Kabelo Dikgang', 'patient', 'male', '72456789', 'kabelo@example.com', 'active'),
    (gen_random_uuid(), '599320044', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Onkemetse Tshukudu', 'patient', 'female', '73567890', 'onkemetse@example.com', 'active'),
    (gen_random_uuid(), '599321155', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Tshepo Mothibi', 'patient', 'male', '74678901', 'tshepo@example.com', 'active'),
    (gen_random_uuid(), '599322266', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Masego Moilwa', 'patient', 'female', '75789012', 'masego@example.com', 'active'),
    (gen_random_uuid(), '599323377', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JzYqQ6gZy', 'Lekgotla Letsholo', 'patient', 'male', '76890123', 'lekgotla@example.com', 'active')
ON CONFLICT (omang) DO NOTHING;

-- Insert patient records (linking to users)
INSERT INTO patients (user_id, omang, date_of_birth, village, district, nationality, department_id)
SELECT 
    u.id, 
    u.omang, 
    CASE u.omang
        WHEN '599317711' THEN '1995-08-15'::DATE
        WHEN '599324411' THEN '1992-02-28'::DATE
        WHEN '599315522' THEN '1985-03-10'::DATE
        WHEN '599327788' THEN '1985-08-22'::DATE
        WHEN '599326677' THEN '1988-07-12'::DATE
        WHEN '599312233' THEN '1978-11-02'::DATE
        WHEN '599318822' THEN '1993-05-20'::DATE
        WHEN '599319933' THEN '1991-09-15'::DATE
        WHEN '599320044' THEN '1994-12-01'::DATE
        WHEN '599321155' THEN '1989-03-25'::DATE
        WHEN '599322266' THEN '1996-07-08'::DATE
        WHEN '599323377' THEN '1987-11-18'::DATE
    END,
    CASE u.omang
        WHEN '599317711' THEN 'Gaborone'
        WHEN '599324411' THEN 'Gaborone'
        WHEN '599315522' THEN 'Francistown'
        WHEN '599327788' THEN 'Francistown'
        WHEN '599326677' THEN 'Maun'
        WHEN '599312233' THEN 'Molepolole'
        WHEN '599318822' THEN 'Lobatse'
        WHEN '599319933' THEN 'Selibe Phikwe'
        WHEN '599320044' THEN 'Kasane'
        WHEN '599321155' THEN 'Jwaneng'
        WHEN '599322266' THEN 'Serowe'
        WHEN '599323377' THEN 'Palapye'
    END,
    CASE u.omang
        WHEN '599317711' THEN 'Gaborone'
        WHEN '599324411' THEN 'Gaborone'
        WHEN '599315522' THEN 'Francistown'
        WHEN '599327788' THEN 'Francistown'
        WHEN '599326677' THEN 'Ngamiland'
        WHEN '599312233' THEN 'Kweneng'
        WHEN '599318822' THEN 'South East'
        WHEN '599319933' THEN 'Central'
        WHEN '599320044' THEN 'Chobe'
        WHEN '599321155' THEN 'South East'
        WHEN '599322266' THEN 'Central'
        WHEN '599323377' THEN 'Central'
    END,
    'Botswana',
    d.id
FROM users u
JOIN departments d ON d.name = 
    CASE u.omang
        WHEN '599317711' THEN 'Cardiology'
        WHEN '599324411' THEN 'Dermatology'
        WHEN '599315522' THEN 'Oncology'
        WHEN '599327788' THEN 'Obstetrics & Gynaecology'
        WHEN '599326677' THEN 'Paediatrics'
        WHEN '599312233' THEN 'Neurology'
        WHEN '599318822' THEN 'Cardiology'
        WHEN '599319933' THEN 'Oncology'
        WHEN '599320044' THEN 'Paediatrics'
        WHEN '599321155' THEN 'Orthopaedics'
        WHEN '599322266' THEN 'Obstetrics & Gynaecology'
        WHEN '599323377' THEN 'Dermatology'
    END
WHERE u.role = 'patient'
ON CONFLICT (omang) DO NOTHING;

-- Link nurses to departments and facilities
INSERT INTO nurses (user_id, employee_id, facility_id, department_id, qualification, years_experience, license_number, is_active)
SELECT 
    u.id, 
    u.employee_id, 
    (SELECT id FROM facilities WHERE code = 'PMH' LIMIT 1), 
    d.id, 
    'Registered Nurse', 
    10, 
    'RN' || u.employee_id, 
    true
FROM users u
JOIN departments d ON d.name = u.department
WHERE u.role = 'head_nurse'
ON CONFLICT (user_id) DO NOTHING;

-- Link specialists
INSERT INTO specialists (user_id, employee_id, specialty_id, facility_id, consultation_duration, max_patients_per_day, is_available)
SELECT 
    u.id, 
    u.employee_id, 
    s.id, 
    (SELECT id FROM facilities WHERE code = 'PMH' LIMIT 1), 
    s.consultation_duration, 
    15, 
    true
FROM users u
JOIN specialties s ON s.name = u.department
WHERE u.role = 'specialist'
ON CONFLICT (user_id) DO NOTHING;

-- Add schedules
INSERT INTO specialist_schedules (specialist_id, day_of_week, start_time, end_time, max_patients)
SELECT s.id, t.day, t.start_t::TIME, t.end_t::TIME, t.max_pat
FROM specialists s
CROSS JOIN (
    VALUES (0, '09:00', '17:00', 8), (1, '09:00', '17:00', 8), (2, '09:00', '17:00', 8),
           (3, '09:00', '17:00', 8), (4, '09:00', '17:00', 8), (5, '09:00', '13:00', 4)
) AS t(day, start_t, end_t, max_pat)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE REFERRALS AND APPOINTMENTS
-- =====================================================
DO $$
DECLARE
    v_patient_id INTEGER;
    v_nurse_id INTEGER;
    v_specialist_id INTEGER;
    v_facility_id INTEGER;
    v_referral_id INTEGER;
BEGIN
    SELECT id INTO v_facility_id FROM facilities WHERE code = 'PMH' LIMIT 1;
    
    -- Patient 1: Leteng Kevin Mpolokeng (Cardiology) -> Dr. John Sebina
    SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.omang = '599317711' LIMIT 1;
    SELECT n.id INTO v_nurse_id FROM nurses n JOIN users u ON u.id = n.user_id WHERE u.employee_id = 'HN001' LIMIT 1;
    SELECT s.id INTO v_specialist_id FROM specialists s JOIN users u ON u.id = s.user_id WHERE u.employee_id = 'SP001' LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
        INSERT INTO referrals (referral_number, patient_id, referring_nurse_id, assigned_specialist_id, referring_facility_id, referred_to_facility_id, reason, priority, status, created_by, created_at)
        VALUES ('REF-2025-00001', v_patient_id, v_nurse_id, v_specialist_id, v_facility_id, v_facility_id, 'Chest pain and shortness of breath', 'urgent', 'assigned', v_nurse_id, NOW())
        RETURNING id INTO v_referral_id;
        INSERT INTO appointments (appointment_number, referral_id, patient_id, specialist_id, appointment_date, duration, status, created_by, created_at)
        VALUES ('APT-2025-00001', v_referral_id, v_patient_id, v_specialist_id, NOW() + INTERVAL '3 days' + INTERVAL '10 hours', 30, 'scheduled', v_nurse_id, NOW());
    END IF;
    
    -- Patient 2: Lorato Kgosi (Dermatology) -> Dr. Kgomotso Thamaga
    SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.omang = '599324411' LIMIT 1;
    SELECT n.id INTO v_nurse_id FROM nurses n JOIN users u ON u.id = n.user_id WHERE u.employee_id = 'HN009' LIMIT 1;
    SELECT s.id INTO v_specialist_id FROM specialists s JOIN users u ON u.id = s.user_id WHERE u.employee_id = 'SP009' LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
        INSERT INTO referrals (referral_number, patient_id, referring_nurse_id, assigned_specialist_id, referring_facility_id, referred_to_facility_id, reason, priority, status, created_by, created_at)
        VALUES ('REF-2025-00002', v_patient_id, v_nurse_id, v_specialist_id, v_facility_id, v_facility_id, 'Persistent skin rash and itching', 'routine', 'assigned', v_nurse_id, NOW())
        RETURNING id INTO v_referral_id;
        INSERT INTO appointments (appointment_number, referral_id, patient_id, specialist_id, appointment_date, duration, status, created_by, created_at)
        VALUES ('APT-2025-00002', v_referral_id, v_patient_id, v_specialist_id, NOW() + INTERVAL '5 days' + INTERVAL '14 hours', 30, 'scheduled', v_nurse_id, NOW());
    END IF;
    
    -- Patient 3: Kagiso Modise (Oncology) -> Dr. Sharon Maiketso
    SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.omang = '599315522' LIMIT 1;
    SELECT n.id INTO v_nurse_id FROM nurses n JOIN users u ON u.id = n.user_id WHERE u.employee_id = 'HN002' LIMIT 1;
    SELECT s.id INTO v_specialist_id FROM specialists s JOIN users u ON u.id = s.user_id WHERE u.employee_id = 'SP002' LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
        INSERT INTO referrals (referral_number, patient_id, referring_nurse_id, assigned_specialist_id, referring_facility_id, referred_to_facility_id, reason, priority, status, created_by, created_at)
        VALUES ('REF-2025-00003', v_patient_id, v_nurse_id, v_specialist_id, v_facility_id, v_facility_id, 'Abnormal chest X-ray, suspected mass', 'urgent', 'assigned', v_nurse_id, NOW() - INTERVAL '2 days')
        RETURNING id INTO v_referral_id;
        INSERT INTO appointments (appointment_number, referral_id, patient_id, specialist_id, appointment_date, duration, status, outcome, created_by, created_at)
        VALUES ('APT-2025-00003', v_referral_id, v_patient_id, v_specialist_id, NOW() - INTERVAL '1 day' + INTERVAL '9 hours', 45, 'completed', 'Patient advised to start chemotherapy', v_nurse_id, NOW() - INTERVAL '2 days');
    END IF;
    
    -- Patient 4: Boitumelo Ramatla (Obstetrics & Gynaecology) -> Dr. Masego Nthoi
    SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.omang = '599327788' LIMIT 1;
    SELECT n.id INTO v_nurse_id FROM nurses n JOIN users u ON u.id = n.user_id WHERE u.employee_id = 'HN007' LIMIT 1;
    SELECT s.id INTO v_specialist_id FROM specialists s JOIN users u ON u.id = s.user_id WHERE u.employee_id = 'SP007' LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
        INSERT INTO referrals (referral_number, patient_id, referring_nurse_id, assigned_specialist_id, referring_facility_id, referred_to_facility_id, reason, priority, status, created_by, created_at)
        VALUES ('REF-2025-00004', v_patient_id, v_nurse_id, v_specialist_id, v_facility_id, v_facility_id, 'Pregnancy with complications', 'emergency', 'assigned', v_nurse_id, NOW() - INTERVAL '3 days')
        RETURNING id INTO v_referral_id;
        INSERT INTO appointments (appointment_number, referral_id, patient_id, specialist_id, appointment_date, duration, status, created_by, created_at)
        VALUES ('APT-2025-00004', v_referral_id, v_patient_id, v_specialist_id, NOW() + INTERVAL '1 day' + INTERVAL '11 hours', 30, 'scheduled', v_nurse_id, NOW());
    END IF;
    
    -- Patient 5: Keitumetse Ntseme (Paediatrics) -> Dr. Kagiso Ndlovu
    SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.omang = '599326677' LIMIT 1;
    SELECT n.id INTO v_nurse_id FROM nurses n JOIN users u ON u.id = n.user_id WHERE u.employee_id = 'HN003' LIMIT 1;
    SELECT s.id INTO v_specialist_id FROM specialists s JOIN users u ON u.id = s.user_id WHERE u.employee_id = 'SP003' LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
        INSERT INTO referrals (referral_number, patient_id, referring_nurse_id, assigned_specialist_id, referring_facility_id, referred_to_facility_id, reason, priority, status, created_by, created_at)
        VALUES ('REF-2025-00005', v_patient_id, v_nurse_id, v_specialist_id, v_facility_id, v_facility_id, 'Persistent fever and cough', 'urgent', 'assigned', v_nurse_id, NOW() - INTERVAL '1 day')
        RETURNING id INTO v_referral_id;
        INSERT INTO appointments (appointment_number, referral_id, patient_id, specialist_id, appointment_date, duration, status, created_by, created_at)
        VALUES ('APT-2025-00005', v_referral_id, v_patient_id, v_specialist_id, NOW() + INTERVAL '2 days' + INTERVAL '9 hours', 30, 'scheduled', v_nurse_id, NOW());
    END IF;
    
    -- Patient 6: Tumelo Masire (Neurology) -> Dr. Lentswe Moremi
    SELECT p.id INTO v_patient_id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.omang = '599312233' LIMIT 1;
    SELECT n.id INTO v_nurse_id FROM nurses n JOIN users u ON u.id = n.user_id WHERE u.employee_id = 'HN005' LIMIT 1;
    SELECT s.id INTO v_specialist_id FROM specialists s JOIN users u ON u.id = s.user_id WHERE u.employee_id = 'SP005' LIMIT 1;
    IF v_patient_id IS NOT NULL THEN
        INSERT INTO referrals (referral_number, patient_id, referring_nurse_id, assigned_specialist_id, referring_facility_id, referred_to_facility_id, reason, priority, status, created_by, created_at)
        VALUES ('REF-2025-00006', v_patient_id, v_nurse_id, v_specialist_id, v_facility_id, v_facility_id, 'Severe headaches and vision problems', 'urgent', 'assigned', v_nurse_id, NOW())
        RETURNING id INTO v_referral_id;
        INSERT INTO appointments (appointment_number, referral_id, patient_id, specialist_id, appointment_date, duration, status, created_by, created_at)
        VALUES ('APT-2025-00006', v_referral_id, v_patient_id, v_specialist_id, NOW() + INTERVAL '4 days' + INTERVAL '13 hours', 45, 'scheduled', v_nurse_id, NOW());
    END IF;
END $$;

-- Final confirmation message
SELECT 'Database schema and seed data created successfully. All users have PIN 1234. Private hospitals added.' AS message;