-- Unified Entry Schema Update
-- Add lesson_type to sessions table for automatic lesson detection

-- Add lesson_type column if it doesn't exist
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lesson_type text DEFAULT 'lesson1';

-- Update existing sessions to have a default lesson_type
UPDATE sessions SET lesson_type = 'lesson1' WHERE lesson_type IS NULL;
