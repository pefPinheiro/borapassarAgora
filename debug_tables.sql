
-- Check table existence and count
SELECT 'bancas' as table_name, count(*) FROM public.bancas
UNION ALL
SELECT 'simulados', count(*) FROM public.simulados
UNION ALL
SELECT 'apostilas', count(*) FROM public.apostilas
UNION ALL
SELECT 'disciplinas', count(*) FROM public.disciplinas;

-- Check RLS Policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('bancas', 'simulados', 'apostilas', 'disciplinas');
