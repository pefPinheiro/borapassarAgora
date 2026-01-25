-- Fix RLS for Profiles to allow Admin Updates on ANY profile
-- This is critical for the "Gestão de Colaboradores" feature to work.

-- 1. Create a secure function to check if the current user is an admin
-- (Isso evita recursão infinita em políticas que consultam a própria tabela profiles)
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean AS $$
BEGIN
  -- Verifica se existe um perfil admin com o ID do usuário atual
  -- USANDO SECURITY DEFINER para bypassar RLS nesta checagem específica
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'super')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing update policies to avoid conflicts
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON profiles;

-- 3. Re-create "Users can update own profile"
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- 4. Create "Admins can update any profile"
CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE
    USING (public.is_admin_safe());

-- 5. Ensure the new columns exist (just in case)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'Comissão',
ADD COLUMN IF NOT EXISTS fixed_payment_value numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fixed_payment_period text DEFAULT 'Mensal',
ADD COLUMN IF NOT EXISTS job_title text;
