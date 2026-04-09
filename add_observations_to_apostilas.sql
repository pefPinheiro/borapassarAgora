-- Add observations column to apostilas
ALTER TABLE apostilas ADD COLUMN IF NOT EXISTS observations TEXT;
