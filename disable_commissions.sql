-- PASSO 1: DESATIVAR PAGAMENTOS AUTOMÁTICOS DE PROFISSIONAIS --
-- Este script remove os gatilhos que geram comissões automaticamente.

-- 1. Remove o trigger principal da tabela de matrículas
DROP TRIGGER IF EXISTS on_enrollment_commission ON public.enrollments;

-- 2. (Opcional) Remove a função para limpar o banco
DROP FUNCTION IF EXISTS public.handle_new_enrollment_commission();

-- 3. Mensagem de confirmação
DO $$ BEGIN RAISE NOTICE 'Gatilhos de pagamento profissional desativados com sucesso.'; END $$;
