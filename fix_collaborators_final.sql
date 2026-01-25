-- SCRIPT DEFINITIVO DE CORREÇÃO --
-- Execute todo este arquivo no Editor SQL do Supabase --

BEGIN;

-- 1. Remover Constraints Restritivas de Status
-- Isso resolve o erro "violates check constraint profiles_status_check"
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- 2. Recriar Constraint aceitando AMBOS formatos (Inglês e Português) para evitar erros
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'blocked', 'pendente', 'suspended', 'inactive', 'Ativo', 'Inativo', 'Pendente'));

-- 3. Garantir colunas necessárias para Colaboradores
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'Comissão';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fixed_payment_value numeric(10, 2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fixed_payment_period text DEFAULT 'Mensal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;

-- 4. Função Segura para verificar Admin (Evita recursão no RLS)
CREATE OR REPLACE FUNCTION public.is_admin_safe() 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'super')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Liberar Permissão de Edição para Admins
-- Remove policies antigas conflitantes
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON profiles;

-- Cria policy nova e permissiva para admins editarem qualquer perfil
CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE
    USING (public.is_admin_safe());

COMMIT;
