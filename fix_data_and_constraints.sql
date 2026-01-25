-- SCRIPT DE MIGRAÇÃO SEGURA PARA CORRIGIR ERROS DE CONSTRAINT --

-- 1. Primeiro, removemos a constraint problemática para podermos limpar os dados
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- 2. Normalizamos os dados que estão causando erro
-- Transformamos tudo para minúsculo/padrão inglês
UPDATE public.profiles SET status = 'active' WHERE status = 'Ativo' OR status = 'ATIVO';
UPDATE public.profiles SET status = 'blocked' WHERE status = 'Inativo' OR status = 'INATIVO' OR status = 'Bloqueado';
UPDATE public.profiles SET status = 'pendente' WHERE status = 'Pendente' OR status = 'PENDENTE';

-- Caso haja algum valor nulo ou estranho, setamos como active ou pendente
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;
UPDATE public.profiles SET status = 'active' WHERE status NOT IN ('active', 'blocked', 'pendente', 'suspended', 'inactive');

-- 3. Agora que os dados estão limpos, reaplicamos a constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'blocked', 'pendente', 'suspended', 'inactive'));

-- 4. Garantir colunas necessárias (Rode novamente para garantir)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'Comissão';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fixed_payment_value numeric(10, 2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fixed_payment_period text DEFAULT 'Mensal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;

-- 5. Função Segura para Admin (Correção de RLS)
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

-- 6. Políticas de RLS
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON profiles;

CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE
    USING (public.is_admin_safe());
