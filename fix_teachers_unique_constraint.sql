-- Fix: Add unique constraint to allow UPSERT on linked_profile_id
ALTER TABLE teachers ADD CONSTRAINT teachers_linked_profile_id_key UNIQUE (linked_profile_id);
