-- Add corporate email and profile link to teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS corporate_email TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS linked_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teachers_corporate_email ON teachers(corporate_email);
CREATE INDEX IF NOT EXISTS idx_teachers_linked_profile_id ON teachers(linked_profile_id);

-- Update RLS if necessary (already allows admin/super)
