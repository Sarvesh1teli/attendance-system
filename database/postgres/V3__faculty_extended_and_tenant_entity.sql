-- =============================================================================
-- Migration V3: Faculty Extended Columns & Tenant Entity Storage
-- Run this script against your PostgreSQL Cloud Database.
-- Ensures reproducible database creation if tables are dropped or rebuilt.
-- =============================================================================

-- 1. Create cloud_tenant_entity table for generic tenant entity storage
CREATE TABLE IF NOT EXISTS cloud_tenant_entity (
    id VARCHAR(128) PRIMARY KEY,
    institution_id VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    data_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_entity_inst_type ON cloud_tenant_entity(institution_id, entity_type);

-- 2. Add extended profile fields to cloud_teacher
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS department_id VARCHAR(64);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS gender VARCHAR(32);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS designation VARCHAR(128);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS email VARCHAR(128);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS joining_date VARCHAR(64);
ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_cloud_teacher_dept ON cloud_teacher(institution_id, department_id);
