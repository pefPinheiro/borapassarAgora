-- Fix 1: Ensure profiles table exists and has correct default values
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone,
  full_name text,
  email text,
  avatar_url text,
  website text,
  role text DEFAULT 'student',
  status text DEFAULT 'active',
  phone text,
  cpf text,
  birth_date text,
  education_level text,
  study_area text,
  bio text,
  experiences jsonb[] DEFAULT '{}',
  certificates jsonb[] DEFAULT '{}'
);

-- Fix 2: Re-create the trigger function to be robust
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 3: Ensure the trigger is actually attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Fix 4: Add INSERT policy for profiles so students can create their own profile if trigger failed
-- This specifically addresses "not creating a student profile" if the trigger fails
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure Update policy exists
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);


-- Grant permissions
GRANT ALL ON TABLE public.profiles TO postgres;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Confirmation: ensure role defaults to 'student'
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'student';
