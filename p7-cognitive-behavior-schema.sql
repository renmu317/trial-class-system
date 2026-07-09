-- P7 Cognitive Behavior System Schema Migration
-- 2026-06-04
-- Adds session_reflection column to students table for Identity Reinforcement

-- Step 1: Add session_reflection column to students table
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS session_reflection text;

-- Comment
COMMENT ON COLUMN students.session_reflection IS 'Student reflection at end of class - used for Identity Reinforcement in parent reports';
