-- Fix RLS for teachers table to allow professors to manage their own profiles
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- 1. Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Professors can view own record" ON teachers;
DROP POLICY IF EXISTS "Professors can update own record" ON teachers;
DROP POLICY IF EXISTS "Professors can insert own record" ON teachers;
DROP POLICY IF EXISTS "Admins full access to teachers" ON teachers;
DROP POLICY IF EXISTS "Public can view active teachers" ON teachers;

-- 2. Policy: Professors can VIEW their own linked record
CREATE POLICY "Professors can view own record" ON teachers
FOR SELECT TO authenticated
USING (auth.uid() = linked_profile_id);

-- 3. Policy: Professors can UPDATE their own linked record
CREATE POLICY "Professors can update own record" ON teachers
FOR UPDATE TO authenticated
USING (auth.uid() = linked_profile_id)
WITH CHECK (auth.uid() = linked_profile_id);

-- 4. Policy: Professors can INSERT their own record (if they are the linked profile)
CREATE POLICY "Professors can insert own record" ON teachers
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = linked_profile_id);

-- 5. Policy: Admins/Super can do EVERYTHING
CREATE POLICY "Admins full access to teachers" ON teachers
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'super' OR role = 'admin')
  )
);

-- 6. Policy: Public/Students can VIEW active teachers
CREATE POLICY "Public can view active teachers" ON teachers
FOR SELECT TO anon, authenticated
USING (status = 'Ativo');
