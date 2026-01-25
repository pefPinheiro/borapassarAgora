
-- Garantir permissões de leitura para tabelas auxiliares
-- Bancas e Disciplinas são dados "públicos" para o sistema (usados em filtros etc)

-- 1. Bancas
ALTER TABLE public.bancas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view bancas" ON bancas;
CREATE POLICY "Authenticated view bancas" ON bancas FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins manage bancas" ON bancas;
CREATE POLICY "Admins manage bancas" ON bancas FOR ALL USING (public.is_admin());

-- 2. Disciplinas
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view disciplinas" ON disciplinas;
CREATE POLICY "Authenticated view disciplinas" ON disciplinas FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins manage disciplinas" ON disciplinas;
CREATE POLICY "Admins manage disciplinas" ON disciplinas FOR ALL USING (public.is_admin());

-- 3. Simulados
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
-- Admins veem tudo
DROP POLICY IF EXISTS "Admins view all simulados" ON simulados;
CREATE POLICY "Admins view all simulados" ON simulados FOR ALL USING (public.is_admin());

-- 4. Apostilas
ALTER TABLE public.apostilas ENABLE ROW LEVEL SECURITY;
-- Admins veem tudo
DROP POLICY IF EXISTS "Admins view all apostilas" ON apostilas;
CREATE POLICY "Admins view all apostilas" ON apostilas FOR ALL USING (public.is_admin());
