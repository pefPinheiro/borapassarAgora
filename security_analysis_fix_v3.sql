-- SECURITY AUDIT & FIX SCRIPT V3 (Final & Corrected)
-- Ajustado para a estrutura real do banco de dados (sem tabelas inexistentes).

-- 1. FUNÇÃO UTILITÁRIA DE ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Tabela PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura Perfil Proprio" ON profiles;
CREATE POLICY "Leitura Perfil Proprio" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Atualizacao Perfil Proprio" ON profiles;
CREATE POLICY "Atualizacao Perfil Proprio" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin Tudo Profiles" ON profiles;
CREATE POLICY "Admin Tudo Profiles" ON profiles FOR ALL USING (public.is_admin());


-- 3. Tabela ENROLLMENTS (Financeiro: Vendas de Entrada)
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aluno ve proprias matriculas" ON enrollments;
CREATE POLICY "Aluno ve proprias matriculas" ON enrollments FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admin gerencia matriculas" ON enrollments;
CREATE POLICY "Admin gerencia matriculas" ON enrollments FOR ALL USING (public.is_admin());


-- 4. Tabela COURSES
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver Cursos Publicos" ON courses;
CREATE POLICY "Ver Cursos Publicos" ON courses FOR SELECT USING (status = 'published' OR status = 'Ativo' OR public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia cursos" ON courses;
CREATE POLICY "Admin gerencia cursos" ON courses FOR ALL USING (public.is_admin());


-- 5. CONTEÚDO (Apostilas, Items, Materiais)
ALTER TABLE public.apostilas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth le apostilas" ON apostilas;
CREATE POLICY "Auth le apostilas" ON apostilas FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth le course_items" ON course_items;
CREATE POLICY "Auth le course_items" ON course_items FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth le course_materials" ON course_materials;
CREATE POLICY "Auth le course_materials" ON course_materials FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth le course_notices" ON course_notices;
CREATE POLICY "Auth le course_notices" ON course_notices FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin apostilas" ON apostilas;
CREATE POLICY "Admin apostilas" ON apostilas FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin course_items" ON course_items;
CREATE POLICY "Admin course_items" ON course_items FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin course_materials" ON course_materials;
CREATE POLICY "Admin course_materials" ON course_materials FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin course_notices" ON course_notices;
CREATE POLICY "Admin course_notices" ON course_notices FOR ALL USING (public.is_admin());


-- 6. SIMULADOS
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_simulados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth le simulados" ON simulados;
CREATE POLICY "Auth le simulados" ON simulados FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth le course_simulados" ON course_simulados;
CREATE POLICY "Auth le course_simulados" ON course_simulados FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin simulados" ON simulados;
CREATE POLICY "Admin simulados" ON simulados FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin course_simulados" ON course_simulados;
CREATE POLICY "Admin course_simulados" ON course_simulados FOR ALL USING (public.is_admin());


-- 7. ACERVO
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth le questoes" ON questions;
CREATE POLICY "Auth le questoes" ON questions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth le notebooks" ON notebooks;
CREATE POLICY "Auth le notebooks" ON notebooks FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth le notebook_questions" ON notebook_questions;
CREATE POLICY "Auth le notebook_questions" ON notebook_questions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin questoes" ON questions;
CREATE POLICY "Admin questoes" ON questions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin notebooks" ON notebooks;
CREATE POLICY "Admin notebooks" ON notebooks FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin notebook_questions" ON notebook_questions;
CREATE POLICY "Admin notebook_questions" ON notebook_questions FOR ALL USING (public.is_admin());


-- 8. FINANCEIRO (Saídas: Custos e Pagamentos Profissionais)
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_payments ENABLE ROW LEVEL SECURITY;

-- Custos: Apenas Admins
DROP POLICY IF EXISTS "Admin ve costs" ON costs;
CREATE POLICY "Admin ve costs" ON costs FOR ALL USING (public.is_admin());

-- Pagamentos Profissionais: Admins veem tudo, usuários veem os seus
DROP POLICY IF EXISTS "Admin ve pagamentos" ON professional_payments;
CREATE POLICY "Admin ve pagamentos" ON professional_payments FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Usuario ve seus pagamentos" ON professional_payments;
CREATE POLICY "Usuario ve seus pagamentos" ON professional_payments FOR SELECT USING (user_id = auth.uid());


-- 9. INVESTIDORES (Tabelas Reais: investor_quotas, investor_config)
ALTER TABLE public.investor_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admin Investor Quotas" ON investor_quotas;
CREATE POLICY "Super Admin Investor Quotas" ON investor_quotas 
FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super', 'admin'))
);

DROP POLICY IF EXISTS "Super Admin Investor Config" ON investor_config;
CREATE POLICY "Super Admin Investor Config" ON investor_config 
FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super', 'admin'))
);

-- (Opcional) Investidor vê suas próprias cotas? Se sim:
DROP POLICY IF EXISTS "Investidor ve suas cotas" ON investor_quotas;
CREATE POLICY "Investidor ve suas cotas" ON investor_quotas FOR SELECT USING (user_id = auth.uid());
