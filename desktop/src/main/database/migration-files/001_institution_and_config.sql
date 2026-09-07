-- Migration 001: Institution and Configuration
-- Creates the core institution identity and configuration tables.

CREATE TABLE IF NOT EXISTS institution (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  email        TEXT,
  logo_path    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS institution_configuration (
  config_id     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  config_key    TEXT NOT NULL,
  config_value  TEXT NOT NULL,
  display_label TEXT,
  data_type     TEXT NOT NULL DEFAULT 'TEXT',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, config_key)
);

CREATE TABLE IF NOT EXISTS app_user (
  user_id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  institution_id TEXT NOT NULL REFERENCES institution(id) ON DELETE CASCADE,
  faculty_id     TEXT,  -- FK added in later migration after faculty table exists
  username       TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK(role IN ('MASTER_ADMIN','ADMIN','FACULTY','VIEWER')),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','LOCKED')),
  last_login     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(institution_id, username)
);
