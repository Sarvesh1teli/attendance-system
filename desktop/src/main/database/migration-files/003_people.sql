-- Migration 003: Faculty and Student tables

CREATE TABLE IF NOT EXISTS faculty (
  faculty_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  employee_id    TEXT NOT NULL,
  name           TEXT NOT NULL,
  gender         TEXT CHECK(gender IN ('MALE','FEMALE','OTHER')),
  date_of_birth  TEXT,
  department_id  TEXT REFERENCES department(department_id),
  designation    TEXT,
  phone          TEXT,
  email          TEXT,
  joining_date   TEXT,
  status         TEXT NOT NULL DEFAULT 'ACTIVE'
                 CHECK(status IN ('ACTIVE','INACTIVE','LEFT')),
  face_enrolled  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, employee_id)
);

-- Add FK from app_user to faculty now that faculty table exists
CREATE INDEX IF NOT EXISTS idx_app_user_faculty ON app_user(faculty_id);

CREATE TABLE IF NOT EXISTS faculty_assignment (
  assignment_id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  faculty_id       TEXT NOT NULL REFERENCES faculty(faculty_id) ON DELETE CASCADE,
  subject_id       TEXT NOT NULL REFERENCES subject(subject_id),
  batch_id         TEXT NOT NULL REFERENCES batch(batch_id),
  academic_year_id TEXT NOT NULL REFERENCES academic_year(academic_year_id),
  semester_id      TEXT REFERENCES semester(semester_id),
  section_id       TEXT REFERENCES section(section_id),
  student_group_id TEXT,  -- FK added after student_group table in migration 004
  assigned_from    TEXT NOT NULL,
  assigned_to      TEXT,
  assigned_by      TEXT,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Partial unique index: prevent duplicate active assignments
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_faculty_assignment
  ON faculty_assignment(institution_id, faculty_id, subject_id, batch_id, academic_year_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_faculty_assignment_faculty
  ON faculty_assignment(faculty_id, status);

-- Student tables
CREATE TABLE IF NOT EXISTS student (
  student_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  gender         TEXT CHECK(gender IN ('MALE','FEMALE','OTHER')),
  date_of_birth  TEXT,
  phone          TEXT,
  parent_phone   TEXT,
  photo_path     TEXT,
  current_status TEXT NOT NULL DEFAULT 'ACTIVE'
                 CHECK(current_status IN (
                   'ACTIVE','INACTIVE','FAILED','REPEATER','DETAINED',
                   'LEFT','DISCONTINUED','TRANSFERRED','COMPLETED'
                 )),
  face_enrolled  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_student_institution
  ON student(institution_id, current_status);

CREATE TABLE IF NOT EXISTS student_admission (
  admission_id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id  TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  admission_number TEXT NOT NULL,
  batch_id        TEXT NOT NULL REFERENCES batch(batch_id),
  course_program_id TEXT NOT NULL REFERENCES course_program(program_id),
  department_id   TEXT REFERENCES department(department_id),
  admission_date  TEXT NOT NULL,
  admission_type  TEXT NOT NULL DEFAULT 'NEW'
                  CHECK(admission_type IN ('NEW','LATERAL','TRANSFER','OTHER')),
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, admission_number)
);

CREATE TABLE IF NOT EXISTS student_academic_enrollment (
  academic_enrollment_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id         TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  student_id             TEXT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  academic_year_id       TEXT NOT NULL REFERENCES academic_year(academic_year_id),
  semester_id            TEXT REFERENCES semester(semester_id),
  current_year_of_study  INTEGER,
  section_id             TEXT REFERENCES section(section_id),
  status                 TEXT NOT NULL DEFAULT 'ACTIVE'
                         CHECK(status IN ('ACTIVE','COMPLETED','WITHDRAWN','TRANSFERRED','FAILED')),
  effective_from         TEXT NOT NULL,
  effective_to           TEXT,
  created_by             TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_subject_enrollment (
  enrollment_id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  student_id       TEXT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  subject_id       TEXT NOT NULL REFERENCES subject(subject_id),
  batch_id         TEXT NOT NULL REFERENCES batch(batch_id),
  academic_year_id TEXT NOT NULL REFERENCES academic_year(academic_year_id),
  semester_id      TEXT REFERENCES semester(semester_id),
  section_id       TEXT REFERENCES section(section_id),
  effective_from   TEXT NOT NULL,
  effective_to     TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'ACTIVE'
                   CHECK(enrollment_status IN ('ACTIVE','COMPLETED','WITHDRAWN','TRANSFERRED','FAILED')),
  created_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enrollment_student_subject
  ON student_subject_enrollment(student_id, subject_id, enrollment_status);

CREATE INDEX IF NOT EXISTS idx_enrollment_effective
  ON student_subject_enrollment(subject_id, batch_id, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS student_roll_history (
  history_id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  student_id       TEXT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  roll_number      TEXT NOT NULL,
  batch_id         TEXT NOT NULL REFERENCES batch(batch_id),
  academic_year_id TEXT NOT NULL REFERENCES academic_year(academic_year_id),
  valid_from       TEXT NOT NULL,
  valid_to         TEXT,
  changed_by       TEXT,
  changed_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
