ALTER TABLE apostilas ADD COLUMN IF NOT EXISTS validation JSONB DEFAULT '{"structure": false, "images": false, "notebooks": false, "questions": false}'::jsonb;
