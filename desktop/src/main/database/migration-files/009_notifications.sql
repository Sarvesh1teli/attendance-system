-- 009_notifications.sql
-- In-app & OS notification store for shortage alerts, sync events, system messages

CREATE TABLE IF NOT EXISTS notification (
  notification_id  TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT    NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  type             TEXT    NOT NULL CHECK(type IN (
                               'SHORTAGE_ALERT', 'SESSION_REMINDER',
                               'SYNC_SUCCESS', 'SYNC_FAILED',
                               'PARENT_ALERT', 'SYSTEM'
                           )),
  severity         TEXT    NOT NULL DEFAULT 'INFO'
                           CHECK(severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  title            TEXT    NOT NULL,
  message          TEXT    NOT NULL,
  entity_type      TEXT,   -- 'STUDENT' | 'FACULTY' | 'SESSION' | NULL
  entity_id        TEXT,   -- FK to the relevant entity
  action_url       TEXT,   -- optional deep link (e.g. /people/students?id=...)
  is_read          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_institution_unread
  ON notification(institution_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_type
  ON notification(institution_id, type, created_at DESC);
