-- Migration 007: Auth Indexes
-- Index username for fast login lookup
CREATE INDEX IF NOT EXISTS idx_app_user_username ON app_user(username);
CREATE INDEX IF NOT EXISTS idx_app_user_faculty ON app_user(faculty_id);
