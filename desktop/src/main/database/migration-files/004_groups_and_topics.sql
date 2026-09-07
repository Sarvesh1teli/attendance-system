-- Migration 004: Student Groups, Group Membership, and Topics
-- Note: SQLite does not support adding FK constraints via ALTER TABLE.
-- The student_group_id FK in faculty_assignment is enforced at service layer.

CREATE TABLE IF NOT EXISTS student_group (
  student_group_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  group_name       TEXT NOT NULL,
  group_type       TEXT NOT NULL
                   CHECK(group_type IN (
                     'SEMINAR','CLINICAL','LAB','PRACTICAL','PROJECT',
                     'SPORTS','ADMINISTRATIVE','TEMPORARY','CUSTOM'
                   )),
  batch_id         TEXT REFERENCES batch(batch_id),
  subject_id       TEXT REFERENCES subject(subject_id),
  valid_from       TEXT NOT NULL,
  valid_to         TEXT,
  created_by       TEXT,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','DISSOLVED')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_student_group_institution
  ON student_group(institution_id, status);

CREATE TABLE IF NOT EXISTS student_group_membership (
  membership_id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  student_group_id TEXT NOT NULL REFERENCES student_group(student_group_id) ON DELETE CASCADE,
  student_id       TEXT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  effective_from   TEXT NOT NULL,
  effective_to     TEXT,
  created_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Active membership uniqueness: a student cannot be in the same group twice simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_group_membership
  ON student_group_membership(student_group_id, student_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS topic (
  topic_id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  subject_id       TEXT NOT NULL REFERENCES subject(subject_id) ON DELETE CASCADE,
  topic_name       TEXT NOT NULL,
  description      TEXT,
  unit_name        TEXT,
  chapter_name     TEXT,
  sequence_number  INTEGER,
  syllabus_id      TEXT,  -- Reserved for future syllabus module
  created_by       TEXT,
  is_custom        INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topic_subject
  ON topic(subject_id, active);
