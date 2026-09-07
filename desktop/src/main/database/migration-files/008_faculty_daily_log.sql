-- Migration 008: Faculty Daily Attendance Log
-- Tracks daily check-in, check-out, working hours, and verification method

CREATE TABLE IF NOT EXISTS faculty_daily_log (
  log_id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id      TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  faculty_id          TEXT NOT NULL REFERENCES faculty(faculty_id) ON DELETE CASCADE,
  log_date            TEXT NOT NULL, -- YYYY-MM-DD
  check_in_time       TEXT NOT NULL, -- HH:MM:SS
  check_out_time      TEXT,          -- HH:MM:SS
  total_minutes       INTEGER DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'PRESENT'
                      CHECK(status IN ('PRESENT', 'HALF_DAY', 'LATE', 'ON_DUTY', 'ABSENT')),
  verification_method TEXT NOT NULL DEFAULT 'MANUAL'
                      CHECK(verification_method IN ('FACE', 'MANUAL', 'ADMIN', 'SYSTEM')),
  device_id           TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, faculty_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_faculty_daily_log_date
  ON faculty_daily_log(institution_id, log_date, status);

CREATE INDEX IF NOT EXISTS idx_faculty_daily_log_faculty
  ON faculty_daily_log(faculty_id, log_date);
