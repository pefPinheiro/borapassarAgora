
-- Solução para o erro de Segurança (RLS references user_metadata)
-- O Supabase alerta que usar `user_metadata` não é seguro pois o usuário pode alterar.
-- A solução correta é usar uma função SECURITY DEFINER para checar o cargo na tabela `profiles`.

-- 1. Criar Função Segura para verificar se é Admin
-- 'SECURITY DEFINER' faz a função rodar com permissões de superusuário,
-- permitindo checar a role na tabela profiles sem ser bloqueado pelo RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar Políticas de Enrollments (Inscrições)
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas/inseguras
DROP POLICY IF EXISTS "Admins ver todas inscricoes" ON enrollments;
DROP POLICY IF EXISTS "Admins view all enrollments" ON enrollments;

-- Criar nova política segura usando a função
CREATE POLICY "Admins ver todas inscricoes" ON enrollments
    FOR ALL
    USING (public.is_admin());

-- Garantir que a política de Alunos continua existindo
DROP POLICY IF EXISTS "Alunos ver proprias inscricoes" ON enrollments;
CREATE POLICY "Alunos ver proprias inscricoes" ON enrollments
    FOR SELECT USING (auth.uid() = profile_id);


-- 3. Atualizar Políticas de Profiles (Perfis) também
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;

-- Admin vê tudo
CREATE POLICY "Admins view all profiles" ON profiles
    FOR SELECT USING (public.is_admin());

-- Usuário vê o próprio (garantia)
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Usuário pode atualizar o próprio
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
