-- Migration 006: Face Enrollment, Device Registration, Audit, Sync, Notifications, Backup

CREATE TABLE IF NOT EXISTS face_recognition_settings (
  settings_id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id           TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  auto_accept_threshold    REAL NOT NULL DEFAULT 0.90,
  manual_review_threshold  REAL NOT NULL DEFAULT 0.75,
  reject_below_threshold   REAL NOT NULL DEFAULT 0.55,
  liveness_enabled         INTEGER NOT NULL DEFAULT 1,
  blink_detection_enabled  INTEGER NOT NULL DEFAULT 1,
  motion_check_enabled     INTEGER NOT NULL DEFAULT 1,
  recognition_timeout_seconds INTEGER NOT NULL DEFAULT 30,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id)
);

CREATE TABLE IF NOT EXISTS face_enrollment (
  enrollment_id  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  entity_type    TEXT NOT NULL CHECK(entity_type IN ('STUDENT','FACULTY')),
  entity_id      TEXT NOT NULL,  -- student_id or faculty_id
  status         TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK(status IN ('ENROLLED','PENDING','FAILED','REVOKED')),
  sample_count   INTEGER NOT NULL DEFAULT 0,
  enrolled_at    TEXT,
  enrolled_by    TEXT,
  last_updated   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS face_sample (
  sample_id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  enrollment_id  TEXT NOT NULL REFERENCES face_enrollment(enrollment_id) ON DELETE CASCADE,
  sample_type    TEXT NOT NULL CHECK(sample_type IN ('FRONT','LEFT','RIGHT','OTHER')),
  file_path      TEXT NOT NULL,  -- Local filesystem path only — never cloud
  quality_score  REAL,
  captured_at    TEXT NOT NULL DEFAULT (datetime('now')),
  is_active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS face_embedding (
  embedding_id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id     TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  enrollment_id      TEXT NOT NULL REFERENCES face_enrollment(enrollment_id) ON DELETE CASCADE,
  model_name         TEXT NOT NULL,    -- e.g. 'mobilefacenet'
  model_version      TEXT NOT NULL,    -- e.g. '1.0'
  embedding_dimension INTEGER NOT NULL, -- e.g. 512
  encrypted_embedding BLOB NOT NULL,   -- AES-256-GCM encrypted Float32Array
  sample_type        TEXT CHECK(sample_type IN ('FRONT','LEFT','RIGHT','OTHER')),
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_embedding_enrollment
  ON face_embedding(enrollment_id, active, model_name);

CREATE TABLE IF NOT EXISTS device (
  device_id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id     TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  faculty_id         TEXT REFERENCES faculty(faculty_id),
  device_fingerprint TEXT NOT NULL,
  device_name        TEXT NOT NULL,
  platform           TEXT NOT NULL,
  registered_at      TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at        TEXT,
  approved_by        TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK(status IN ('PENDING','APPROVED','REVOKED')),
  last_seen          TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT REFERENCES institution(id),
  user_id       TEXT,
  user_role     TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  old_value     TEXT,  -- JSON string
  new_value     TEXT,  -- JSON string
  reason        TEXT,
  device_id     TEXT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON audit_log(institution_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS sync_log (
  log_id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id    TEXT REFERENCES institution(id),
  device_id         TEXT,
  faculty_id        TEXT,
  sync_direction    TEXT NOT NULL CHECK(sync_direction IN ('UPLOAD','DOWNLOAD')),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT,
  sync_status       TEXT NOT NULL
                    CHECK(sync_status IN ('SUCCESS','FAILED','PARTIAL','DUPLICATE','CONFLICT','STALE')),
  error_code        TEXT,
  error_message     TEXT,
  records_attempted INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0,
  records_failed    INTEGER NOT NULL DEFAULT 0,
  started_at        TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_conflict (
  conflict_id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id        TEXT REFERENCES institution(id),
  session_id            TEXT,
  entity_type           TEXT NOT NULL,
  entity_id             TEXT NOT NULL,
  conflict_type         TEXT NOT NULL
                        CHECK(conflict_type IN (
                          'VERSION_MISMATCH','STALE_UPDATE','STATE_VIOLATION','DUPLICATE_SESSION'
                        )),
  local_version         INTEGER,
  incoming_version      INTEGER,
  local_version_json    TEXT,     -- JSON snapshot of local record
  incoming_version_json TEXT,     -- JSON snapshot of incoming record
  detected_at           TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at           TEXT,
  resolved_by           TEXT,
  resolution_action     TEXT
                        CHECK(resolution_action IN ('KEPT_LOCAL','ACCEPTED_MOBILE','MERGED')),
  audit_id              TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outbox_event (
  event_id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT REFERENCES institution(id),
  event_type     TEXT NOT NULL,
  payload        TEXT NOT NULL,  -- JSON
  status         TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK(status IN ('PENDING','PROCESSING','DELIVERED','FAILED','DEAD_LETTER')),
  attempt_count  INTEGER NOT NULL DEFAULT 0,
  next_retry_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at   TEXT
);

CREATE TABLE IF NOT EXISTS notification_log (
  notification_id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id     TEXT REFERENCES institution(id),
  student_id         TEXT REFERENCES student(student_id),
  session_id         TEXT,
  notification_type  TEXT NOT NULL
                     CHECK(notification_type IN (
                       'ABSENT','LOW_ATTENDANCE','DAILY_ABSENCE_SUMMARY',
                       'WEEKLY_SUMMARY','MONTHLY_SUMMARY','ATTENDANCE_SHORTAGE_WARNING'
                     )),
  channel            TEXT NOT NULL CHECK(channel IN ('WHATSAPP','SMS','EMAIL')),
  recipient          TEXT NOT NULL,
  deduplication_key  TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK(status IN ('PENDING','SENT','DELIVERED','FAILED','SUPPRESSED')),
  sent_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(deduplication_key)
);

CREATE TABLE IF NOT EXISTS backup_metadata (
  backup_id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id      TEXT REFERENCES institution(id),
  backup_filename     TEXT NOT NULL,
  backup_type         TEXT NOT NULL CHECK(backup_type IN ('SCHEDULED','MANUAL','PRE_RESTORE')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  application_version TEXT NOT NULL,
  schema_version      INTEGER NOT NULL,
  row_counts_json     TEXT,  -- JSON with table row counts
  checksum            TEXT NOT NULL,
  drive_file_id       TEXT,
  upload_status       TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK(upload_status IN ('PENDING','UPLOADED','FAILED')),
  notes               TEXT
);
