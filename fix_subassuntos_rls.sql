-- Removendo as políticas antigas que faziam Select direto na tabela Profiles
DROP POLICY IF EXISTS "Enable full access for admin users on subsubassuntos" ON public.subsubassuntos;
DROP POLICY IF EXISTS "Enable full access for admin users on subassuntos" ON public.subassuntos;

-- Criando as políticas novas baseadas na função já segura (is_admin) do seu projeto:
CREATE POLICY "Enable full access for admin users on subassuntos" ON public.subassuntos FOR ALL USING (public.is_admin());
CREATE POLICY "Enable full access for admin users on subsubassuntos" ON public.subsubassuntos FOR ALL USING (public.is_admin());

-- Recarregando schema cache
NOTIFY pgrst, 'reload schema';
