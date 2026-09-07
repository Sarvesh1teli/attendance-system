-- 010_batch_notify_parents.sql
-- Per-batch control: should shortage alerts be sent to parents?
-- Default ON (1) — admin can disable for adult programs (MBBS, BE, MCA, etc.)

ALTER TABLE batch ADD COLUMN notify_parents INTEGER NOT NULL DEFAULT 1;
