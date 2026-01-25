ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experiences JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '[]'::jsonb;
