-- SECURITY AUDIT & FIX SCRIPT
-- Objetivo: Garantir que o módulo aluno seja seguro e blindado contra acessos indevidos.

-- 1. FUNÇÃO UTILITÁRIA DE ADMIN (Garante que 'admin' não depende de metadata inseguro)
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


-- 2. FUNÇÃO PARA VERIFICAR MATRÍCULA (Segurança de Conteúdo)
-- Retorna true se o usuário atual tem matrícula ativa no curso informado
CREATE OR REPLACE FUNCTION public.has_active_enrollment(course_id_param UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE profile_id = auth.uid()
    AND course_id = course_id_param
    AND status = 'active'
    AND (valid_until IS NULL OR valid_until > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. REFORÇO DE RLS (Row Level Security)

-- Tabela PROFILES (Dados Pessoais)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura Perfil Proprio" ON profiles;
CREATE POLICY "Leitura Perfil Proprio" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Atualizacao Perfil Proprio" ON profiles;
CREATE POLICY "Atualizacao Perfil Proprio" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin Tudo Profiles" ON profiles;
CREATE POLICY "Admin Tudo Profiles" ON profiles
    FOR ALL USING (public.is_admin());


-- Tabela ENROLLMENTS (Matrículas)
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aluno ve proprias matriculas" ON enrollments;
CREATE POLICY "Aluno ve proprias matriculas" ON enrollments
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admin gerencia matriculas" ON enrollments;
CREATE POLICY "Admin gerencia matriculas" ON enrollments
    FOR ALL USING (public.is_admin());


-- Tabela COURSES (Cursos)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ver cursos publicados (Catálogo)
DROP POLICY IF EXISTS "Ver Cursos Publicos" ON courses;
CREATE POLICY "Ver Cursos Publicos" ON courses
    FOR SELECT USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia cursos" ON courses;
CREATE POLICY "Admin gerencia cursos" ON courses
    FOR ALL USING (public.is_admin());


-- Tabela MODULES e LESSONS (Conteúdo do Curso)
-- Idealmente: Só quem tem matrícula OU é Preview.
-- Por enquanto, vamos permitir SELECT para autenticados para evitar quebrar o app atual indevidamente,
-- mas a função `has_active_enrollment` está pronta para uso futuro mais restritivo.
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver Modulos Publicos" ON modules;
CREATE POLICY "Ver Modulos Publicos" ON modules
    FOR SELECT USING (true); -- Aberto leitura, frontend controla acesso por enquanto.

DROP POLICY IF EXISTS "Admin Modulos" ON modules;
CREATE POLICY "Admin Modulos" ON modules
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Ver Aulas Publicas" ON lessons;
CREATE POLICY "Ver Aulas Publicas" ON lessons
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Aulas" ON lessons;
CREATE POLICY "Admin Aulas" ON lessons
    FOR ALL USING (public.is_admin());


-- Tabela LESSON_PROGRESS (Progresso do Aluno)
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aluno gerencia progresso" ON lesson_progress;
CREATE POLICY "Aluno gerencia progresso" ON lesson_progress
    FOR ALL USING (profile_id = auth.uid());


-- Tabela QUESTIONS e NOTEBOOKS (Acervo)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_questions ENABLE ROW LEVEL SECURITY;

-- Questões: Leitura pública para alunos logados
DROP POLICY IF EXISTS "Alunos leem questoes" ON questions;
CREATE POLICY "Alunos leem questoes" ON questions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Notebooks: Leitura pública para alunos logados
DROP POLICY IF EXISTS "Alunos leem notebooks" ON notebooks;
CREATE POLICY "Alunos leem notebooks" ON notebooks
    FOR SELECT USING (auth.role() = 'authenticated');

-- Admin gerencia
DROP POLICY IF EXISTS "Admin questoes" ON questions;
CREATE POLICY "Admin questoes" ON questions
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin notebooks" ON notebooks;
CREATE POLICY "Admin notebooks" ON notebooks
    FOR ALL USING (public.is_admin());


-- 4. DADOS SENSÍVEIS (Financeiro)
-- Garantir bloqueio total a não-admins
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bloqueio Total Sales" ON sales;
CREATE POLICY "Admin ve sales" ON sales
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Bloqueio Total Costs" ON costs;
CREATE POLICY "Admin ve costs" ON costs
    FOR ALL USING (public.is_admin());
    
-- Investors: Super admin only
DROP POLICY IF EXISTS "Bloqueio Total Investors" ON investors;
CREATE POLICY "Super Admin ve investors" ON investors
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super')
    );

