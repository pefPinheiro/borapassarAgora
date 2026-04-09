-- ⚠️ ATENÇÃO: Esta operação é destrutiva e removerá permanentemente os usuários.
-- O script abaixo deleta todos os perfis e usuários da autenticação, EXCETO os com cargo 'super'.

-- 1. Identifica e deleta da tabela de perfis (público)
DELETE FROM public.profiles 
WHERE role != 'super';

-- 2. Deleta da tabela de autenticação (auth.users)
-- Nota: Isso requer permissões de administrador de banco de dados (service_role).
DELETE FROM auth.users 
WHERE id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'super'
);

-- Opcional: Limpeza de registros órfãos em outras tabelas se necessário
-- (Geralmente coberto por ON DELETE CASCADE se configurado corretamente)
