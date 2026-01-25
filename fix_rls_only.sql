
-- 1. Políticas de Perfis (Profiles)
-- Permitir que qualquer usuário autenticado leia dados básicos (nome/email) de outros perfis
-- Isso é necessário para o Admin ver os nomes dos alunos nas listas.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view profiles" ON profiles;
CREATE POLICY "Authenticated can view profiles" ON profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 2. Políticas de Inscrições (Enrollments)
-- Permitir que o Admin veja TODAS as inscrições.
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins ver todas inscricoes" ON enrollments;
CREATE POLICY "Admins ver todas inscricoes" ON enrollments
    FOR ALL
    USING (
         -- Verifica se o usuário tem role 'admin' nos metadados OU na tabela profiles
         (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
         (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    );

-- 3. (OPCIONAL DE DEBUG) - Se nada funcionar, descrome a linha abaixo para liberar geral temporariamente
-- CREATE POLICY "Liberou Geral Enrollments" ON enrollments FOR SELECT USING (true);
