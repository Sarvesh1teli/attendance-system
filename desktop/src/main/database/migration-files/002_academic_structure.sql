-- Migration 002: Academic Structure
-- Department, Program, Batch, Academic Year, Semester, Section, Subject

CREATE TABLE IF NOT EXISTS department (
  department_id   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id  TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  department_code TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, department_name)
);

CREATE TABLE IF NOT EXISTS course_program (
  program_id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id           TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  program_name             TEXT NOT NULL,
  program_code             TEXT NOT NULL,
  duration_years           INTEGER NOT NULL DEFAULT 3,
  academic_structure_type  TEXT NOT NULL DEFAULT 'SEMESTER'
                           CHECK(academic_structure_type IN ('SEMESTER','YEAR','TERM','CUSTOM')),
  department_id            TEXT REFERENCES department(department_id),
  active                   INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, program_code)
);

CREATE TABLE IF NOT EXISTS batch (
  batch_id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id            TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  batch_name                TEXT NOT NULL,
  program_id                TEXT NOT NULL REFERENCES course_program(program_id),
  department_id             TEXT REFERENCES department(department_id),
  admission_year            INTEGER NOT NULL,
  expected_completion_year  INTEGER NOT NULL,
  active                    INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academic_year (
  academic_year_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  year_label       TEXT NOT NULL,
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  is_current       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, year_label)
);

CREATE TABLE IF NOT EXISTS semester (
  semester_id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_year(academic_year_id),
  semester_name  TEXT NOT NULL,
  semester_number INTEGER NOT NULL,
  start_date     TEXT,
  end_date       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS section (
  section_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  batch_id       TEXT NOT NULL REFERENCES batch(batch_id),
  section_name   TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(batch_id, section_name)
);

CREATE TABLE IF NOT EXISTS subject (
  subject_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  subject_name   TEXT NOT NULL,
  subject_code   TEXT NOT NULL,
  department_id  TEXT REFERENCES department(department_id),
  program_id     TEXT REFERENCES course_program(program_id),
  subject_type   TEXT NOT NULL DEFAULT 'THEORY'
                 CHECK(subject_type IN ('THEORY','PRACTICAL','CLINICAL','SEMINAR','LABORATORY','PROJECT','OTHER')),
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, subject_code)
);

CREATE TABLE IF NOT EXISTS subject_attendance_rules (
  rule_id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id      TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  subject_id          TEXT NOT NULL REFERENCES subject(subject_id) ON DELETE CASCADE,
  minimum_percentage  REAL NOT NULL DEFAULT 75.0,
  warning_percentage  REAL NOT NULL DEFAULT 80.0,
  grace_percentage    REAL NOT NULL DEFAULT 0.0,
  attendance_required INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, subject_id)
);

CREATE TABLE IF NOT EXISTS academic_calendar (
  calendar_id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES academic_year(academic_year_id),
  event_type       TEXT NOT NULL
                   CHECK(event_type IN ('HOLIDAY','EXAM','VACATION','SPECIAL_WORKING_DAY','OTHER')),
  event_name       TEXT NOT NULL,
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  applies_to_all   INTEGER NOT NULL DEFAULT 1,
  batch_id         TEXT REFERENCES batch(batch_id),
  department_id    TEXT REFERENCES department(department_id),
  created_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for calendar holiday lookups
CREATE INDEX IF NOT EXISTS idx_calendar_dates
  ON academic_calendar(institution_id, start_date, end_date);
