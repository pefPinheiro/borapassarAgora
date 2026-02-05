/**
 * Script to update Storage Permissions for Apostilas
 * 
 * Objective: Allow authenticated users (e.g. admins/editors) to upload files to:
 * bucket: 'public'
 * folder: 'apostilas/DISCIPLINE_NAME/SUBJECT_NAME/*'
 *
 * This script ensures that the 'public' bucket permissions allow uploads to the 'apostilas' folder and its subfolders.
 */

-- 1. Ensure the 'public' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Enable RLS on objects (standard practice)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies specific to Apostilas to avoid conflicts
-- Note: Adjust policy names if your existing policies are named differently.
DROP POLICY IF EXISTS "Apostilas Upload Policy" ON storage.objects;
DROP POLICY IF EXISTS "Apostilas Select Policy" ON storage.objects;
DROP POLICY IF EXISTS "Apostilas Update Policy" ON storage.objects;
DROP POLICY IF EXISTS "Apostilas Delete Policy" ON storage.objects;

-- 4. Create new policies

-- Allow Uploads to 'apostilas' folder (and any subfolder) for authenticated users
CREATE POLICY "Apostilas Upload Policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'apostilas'
);

-- Allow Public Read Access to everything in 'public' bucket (or restrict to apostilas if preferred)
-- Here we allow public read for the whole bucket as images need to be accessible.
CREATE POLICY "Apostilas Select Policy"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'public'
);

-- Allow Updates (overwrite) for authenticated users in 'apostilas' folder
CREATE POLICY "Apostilas Update Policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'apostilas'
);

-- Allow Deletion for authenticated users in 'apostilas' folder
CREATE POLICY "Apostilas Delete Policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'apostilas'
);
