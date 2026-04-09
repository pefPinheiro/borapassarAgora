-- 🛡️ SCRIPT DE DELEÇÃO SEGURA COM TRANSFERÊNCIA DE AUTORIA
-- Este script transfere todo o conteúdo para o Super Admin antes de deletar os outros usuários.

DO $$ 
DECLARE 
    v_super_id uuid;
BEGIN
    -- 1. Identifica o primeiro Super Admin disponível para receber o conteúdo
    SELECT id INTO v_super_id FROM public.profiles WHERE role = 'super' LIMIT 1;

    IF v_super_id IS NULL THEN
        RAISE EXCEPTION 'Não foi encontrado nenhum usuário com role "super" para receber o conteúdo.';
    END IF;

    -- 2. Transferência de Autoria (Tabela Profiles)
    UPDATE public.apostilas 
    SET author_id = v_super_id 
    WHERE author_id != v_super_id OR author_id IS NULL;

    -- 3. Limpeza de Vínculos de Staff (Como Teachers e Editors serão deletados, removemos o vínculo)
    -- Definimos como NULL para evitar erro de chave estrangeira
    UPDATE public.apostilas 
    SET professor_id = NULL;

    UPDATE public.apostilas 
    SET assigned_editor_id = NULL;

    -- 4. Transferência de Validação em Questões
    UPDATE public.questions 
    SET validator_id = v_super_id 
    WHERE validator_id != v_super_id;

    -- 5. Limpeza de Dados Transacionais e Referências Cruzadas
    -- Deletamos registros de tabelas que travam a deleção de perfis (FK sem CASCADE)
    DELETE FROM public.support_messages WHERE sender_id != v_super_id;
    DELETE FROM public.support_tickets WHERE student_id != v_super_id;
    DELETE FROM public.admin_messages WHERE sender_id != v_super_id OR recipient_id != v_super_id;
    DELETE FROM public.professional_payments WHERE user_id != v_super_id;
    DELETE FROM public.investor_quotas WHERE user_id != v_super_id;
    DELETE FROM public.teachers; -- Deleta todos os professores para permitir a deleção dos perfis

    -- 6. Finalmente, deletar os perfis que não são Super
    DELETE FROM public.profiles WHERE id != v_super_id AND role != 'super';

    -- 7. Deletar da autenticação do Supabase
    DELETE FROM auth.users WHERE id != v_super_id;

    RAISE NOTICE 'Limpeza concluída. Todo o conteúdo foi transferido para o Super Admin (ID: %)', v_super_id;

END $$;
