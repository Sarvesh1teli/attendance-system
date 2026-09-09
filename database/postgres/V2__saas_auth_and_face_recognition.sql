-- =============================================================================
-- Migration V2: Cloud SaaS Authentication & Faculty/Student Face Recognition
-- Run this script against your PostgreSQL Cloud Database before deploying the new jar.
-- =============================================================================

-- 1. Ensure cloud_student_roster has face_descriptor column
ALTER TABLE cloud_student_roster 
ADD COLUMN IF NOT EXISTS face_descriptor TEXT;

-- 2. Create or update cloud_teacher table for multi-tenant faculty login & biometric matching
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

ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS pin VARCHAR(20);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_cloud_teacher_inst ON cloud_teacher(institution_id);
CREATE INDEX IF NOT EXISTS idx_cloud_teacher_user ON cloud_teacher(institution_id, username);

-- 3. Create cloud_app_user table for SaaS Admin Web Login
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

-- 4. Seed default college institution if not present
INSERT INTO cloud_tenant_institution (id, name, api_key, status)
VALUES ('svhs', 'SVHS Institute of Sciences', 'api_key_svhs_default', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed default SaaS Admin user (admin / admin123)
INSERT INTO cloud_app_user (id, institution_id, username, password_hash, role, status)
VALUES ('usr-admin-01', 'svhs', 'admin', 'admin123', 'ADMIN', 'ACTIVE')
ON CONFLICT (institution_id, username) DO NOTHING;
