-- 013_face_descriptor.sql
-- Store the 128-dimensional mathematical face embedding vector (JSON float array)
-- Allows privacy-compliant sync to cloud and Teacher PWA (no photos are synced)

ALTER TABLE face_enrollment ADD COLUMN face_descriptor TEXT;
