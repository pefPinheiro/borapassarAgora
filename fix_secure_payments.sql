-- SCRIPT DE AJUSTE PARA PAGAMENTO SEGURO --
-- Este script expande a constraint de status da tabela enrollments
-- para permitir estados pendentes durante o processamento do Mercado Pago.

-- 1. Remove a restrição atual
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;

-- 2. Recria a restrição incluindo todos os estados de transição necessários
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check 
CHECK (status IN (
    'Pendente', -- Estado inicial ao clicar em comprar
    'Ativo',    -- Confirmado pelo Webhook após pagamento
    'Cancelado',-- Rejeitado ou cancelado pelo usuário
    'Expirado', -- Prazo de acesso vencido
    'Reembolsado', -- Devolvido via garantia de 7 dias
    'Bloqueado' -- Suspensão manual por fraude/compartilhamento
));

-- 3. Garante que os campos de auditoria e financeiro existam (Redundância de segurança)
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS amount_discount numeric(10,2) DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS coupon_applied text;

-- 4. Mensagem de êxito
DO $$ BEGIN RAISE NOTICE 'Banco de Dados preparado para Pagamentos Seguros.'; END $$;
