-- 011_timetable.sql
-- Weekly recurring timetable slots for automatic session generation

CREATE TABLE IF NOT EXISTS timetable_slot (
  slot_id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id   TEXT    NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  subject_id       TEXT    NOT NULL REFERENCES subject(subject_id),
  batch_id         TEXT    NOT NULL REFERENCES batch(batch_id),
  group_id         TEXT    REFERENCES student_group(student_group_id),
  faculty_id       TEXT    REFERENCES faculty(faculty_id),
  room             TEXT,
  day_of_week      INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
                            -- 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  start_time       TEXT    NOT NULL,  -- 'HH:MM' 24-hr format
  end_time         TEXT    NOT NULL,
  effective_from   TEXT,   -- ISO date, NULL = always
  effective_until  TEXT,   -- ISO date, NULL = ongoing
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timetable_day
  ON timetable_slot(institution_id, day_of_week, active);

CREATE INDEX IF NOT EXISTS idx_timetable_subject
  ON timetable_slot(subject_id);

CREATE INDEX IF NOT EXISTS idx_timetable_batch
  ON timetable_slot(batch_id);
