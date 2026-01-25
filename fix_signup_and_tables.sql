-- 1. Ensure Profiles table has all necessary columns
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone,
  full_name text,
  email text,
  avatar_url text,
  website text,
  role text DEFAULT 'student',
  status text DEFAULT 'active'
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS study_area text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experiences jsonb[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certificates jsonb[] DEFAULT '{}';


-- 2. Fix Permissions for Profiles (Allow student to create their own profile if trigger fails)
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

GRANT ALL ON TABLE public.profiles TO postgres;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;


-- 3. Robust Trigger for User Creation (Handles potential errors gracefully)
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
  -- Log error but don't fail the signup (user will be created, profile might be missing but can be created by UI)
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 4. Create student_question_history table (Fixes 404 errors)
CREATE TABLE IF NOT EXISTS public.student_question_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id uuid NOT NULL, -- soft link or FK if questions table exists. Assuming loose FK for now or exact if safe.
    selected_alternative_index int,
    is_correct boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(student_id, question_id)
);

-- RLS for student_question_history
ALTER TABLE public.student_question_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own question history" ON student_question_history;
CREATE POLICY "Students manage own question history" ON student_question_history
    FOR ALL USING (auth.uid() = student_id);

GRANT ALL ON TABLE public.student_question_history TO authenticated;
GRANT ALL ON TABLE public.student_question_history TO service_role;
