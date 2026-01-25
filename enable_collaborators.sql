-- Create Collaborator Schema Enhancements

-- 1. Add columns to profiles for access control and payment settings
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'Comissão', -- 'Fixo', 'Comissão'
ADD COLUMN IF NOT EXISTS fixed_payment_value numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fixed_payment_period text DEFAULT 'Mensal', -- 'Mensal', 'Serviço'
ADD COLUMN IF NOT EXISTS job_title text; -- Cargo/Função

-- 2. Update RLS policies to allow Admins to manage these columns
-- (Already covered by "Admins view all profiles" and "Users update own profile", 
-- but we need Admins to UPDATE OTHER profiles for this to work)

DROP POLICY IF EXISTS "Admins update all profiles" ON profiles;
CREATE POLICY "Admins update all profiles" ON profiles
    FOR UPDATE
    USING (public.is_admin());

-- 3. Ensure checking for admin doesn't cause recursion if is_admin uses profiles
-- The function is_admin() created earlier uses SECURITY DEFINER, so it bypasses RLS, which is good.

-- 4. Check if 'modules' are consistent
-- We will store keys like ['cursos', 'questoes', 'financeiro', etc.] in allowed_modules

-- 5. Fix potential issue with users not being able to read their own permissions if we had stricter RLS
-- But "Users view own profile" is usually enabled.

-- 6. Trigger to log status changes (Optional but good for audit)
-- (Skipping for now to keep it simple)
