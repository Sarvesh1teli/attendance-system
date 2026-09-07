-- 012_face_enrollment_columns.sql
-- Add missing created_at, updated_at, revoked_at, revoked_by to face_enrollment
-- Add missing created_at, updated_at, captured_by to face_sample

ALTER TABLE face_enrollment ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE face_enrollment ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE face_enrollment ADD COLUMN revoked_at TEXT;
ALTER TABLE face_enrollment ADD COLUMN revoked_by TEXT;

ALTER TABLE face_sample ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE face_sample ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE face_sample ADD COLUMN captured_by TEXT;
