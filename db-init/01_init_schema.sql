-- =============================================================================
-- PostgreSQL Cloud Synchronization Schema (Multi-Tenant)
-- Teli Face Recognition Attendance System
-- Rule: Every tenant-owned table MUST contain institution_id
-- Rule: Biometric photos are NEVER stored in cloud (Zero Cloud Photo Policy)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cloud_tenant_institution (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    license_key VARCHAR(128),
    api_key VARCHAR(128) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Syllabus Topics synchronized from desktop
CREATE TABLE IF NOT EXISTS cloud_topic (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    subject_id VARCHAR(64) NOT NULL,
    topic_name VARCHAR(255) NOT NULL,
    unit_name VARCHAR(255),
    sequence_number INT,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cloud_topic_inst_subj ON cloud_topic(institution_id, subject_id);

-- Minimal Student Roster (NO BIOMETRIC PHOTOS - zero cloud photo policy)
CREATE TABLE IF NOT EXISTS cloud_student_roster (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL,
    batch_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    admission_number VARCHAR(64) NOT NULL,
    gender VARCHAR(16),
    face_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    face_descriptor TEXT,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cloud_student_inst UNIQUE(institution_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_cloud_student_batch ON cloud_student_roster(institution_id, batch_id);

-- Teacher Class & Schedule Assignments
CREATE TABLE IF NOT EXISTS cloud_class_assignment (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    faculty_id VARCHAR(64) NOT NULL,
    batch_id VARCHAR(64) NOT NULL,
    batch_name VARCHAR(255) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    subject_code VARCHAR(64) NOT NULL,
    program_name VARCHAR(255) NOT NULL,
    academic_year_id VARCHAR(64) NOT NULL,
    group_id VARCHAR(64),
    group_name VARCHAR(255),
    schedule_time VARCHAR(64),
    room VARCHAR(64),
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cloud_class_faculty ON cloud_class_assignment(institution_id, faculty_id);

-- Central Attendance Sessions
CREATE TABLE IF NOT EXISTS cloud_attendance_session (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    faculty_id VARCHAR(64) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    batch_id VARCHAR(64) NOT NULL,
    academic_year_id VARCHAR(64) NOT NULL,
    student_group_id VARCHAR(64),
    session_date DATE NOT NULL,
    start_time VARCHAR(32) NOT NULL,
    end_time VARCHAR(32),
    status VARCHAR(32) NOT NULL CHECK(status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
    topic_id VARCHAR(64),
    custom_topic VARCHAR(255),
    source_device VARCHAR(64) DEFAULT 'TEACHER_PWA',
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cloud_session_inst_sess UNIQUE(institution_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_cloud_session_date ON cloud_attendance_session(institution_id, session_date);

-- Attendance Records (Granular per student)
-- Follows Option A rule for absences and VOIDED status for cancelled sessions
CREATE TABLE IF NOT EXISTS cloud_attendance_record (
    id VARCHAR(64) PRIMARY KEY,
    record_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    recognition_method VARCHAR(32) NOT NULL CHECK(recognition_method IN ('SYSTEM_DEFAULT', 'MANUAL_TEACHER', 'FACE_RECOGNITION')),
    record_state VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK(record_state IN ('ACTIVE', 'VOIDED')),
    confidence_score NUMERIC(5, 4),
    marked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cloud_record_sess_stu UNIQUE(institution_id, session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_cloud_record_session ON cloud_attendance_record(institution_id, session_id);

-- Version Conflict & Divergence Audit Log
CREATE TABLE IF NOT EXISTS cloud_sync_conflict (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    incoming_version BIGINT NOT NULL,
    stored_version BIGINT NOT NULL,
    incoming_payload TEXT NOT NULL,
    stored_payload TEXT NOT NULL,
    resolution_strategy VARCHAR(64) NOT NULL DEFAULT 'LOG_AND_STORED_WINS',
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cloud_conflict_inst ON cloud_sync_conflict(institution_id, resolved);

-- Cloud Outbox Event Queue (Desktop Consumers pull from here)
CREATE TABLE IF NOT EXISTS cloud_outbox_event (
    id BIGSERIAL PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cloud_outbox_inst_id ON cloud_outbox_event(institution_id, id);

-- Teacher & Faculty Multi-Tenant Roster (with facial vector embeddings for biometric login)
CREATE TABLE IF NOT EXISTS cloud_teacher (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(64),
    username VARCHAR(64),
    pin VARCHAR(20),
    password_hash VARCHAR(255),
    face_descriptor TEXT,
    department VARCHAR(255),
    institution_name VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cloud_teacher_inst ON cloud_teacher(institution_id);
CREATE INDEX IF NOT EXISTS idx_cloud_teacher_user ON cloud_teacher(institution_id, username);

-- SaaS Web Admin Users
CREATE TABLE IF NOT EXISTS cloud_app_user (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) NOT NULL REFERENCES cloud_tenant_institution(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cloud_app_user_inst_user UNIQUE(institution_id, username)
);
CREATE INDEX IF NOT EXISTS idx_cloud_app_user_inst ON cloud_app_user(institution_id);
