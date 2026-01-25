-- 1. Remove the restrictive check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Clean up any invalid data that might exist
UPDATE public.profiles SET role = 'student' WHERE role IS NULL;

-- 3. Re-add constraint allowing 'student', 'admin', 'super', and 'collaborator'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('student', 'admin', 'super', 'collaborator'));

-- 4. Ensure trigger handles conflicts gracefully by trying to UPDATE if INSERT fails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = COALESCE(EXCLUDED.role, profiles.role),
    updated_at = now();
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add RLS for self-insert if it was missing (backup for trigger fail)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- 6. Grant permissions explicitly
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
