-- 1. Remove a constraint antiga se existir
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. LIMPEZA AGRESSIVA DE DADOS INVÁLIDOS
-- Transforma qualquer coisa que não seja admin/super/collaborator em 'student'
UPDATE public.profiles 
SET role = 'student' 
WHERE role NOT IN ('admin', 'super', 'collaborator');

-- 3. Garante que nulos virem student também
UPDATE public.profiles 
SET role = 'student' 
WHERE role IS NULL;

-- 4. Agora sim, aplica a constraint com segurança
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('student', 'admin', 'super', 'collaborator'));
