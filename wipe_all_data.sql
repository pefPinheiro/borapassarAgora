-- WIPE DATABASE SCRIPT
-- ATENÇÃO: ESTE SCRIPT APAGA TODOS OS DADOS DAS TABELAS DO ESQUEMA PUBLIC.
-- DADOS DE LOGIN (AUTH.USERS) DO SUPABASE NÃO SÃO APAGADOS AQUI, MAS OS PERFIS (PROFILES) SERÃO.
-- OS USUÁRIOS PRECISARÃO SER RECRIADOS OU O TRIGGER DE NEW USER PRECISARÁ RODAR NOVAMENTE SE POSSÍVEL.

BEGIN;

-- Desabilitar triggers temporariamente para evitar erros em cascata complexos (opcional, mas CASCADE no truncate resolve a maioria)
-- SET session_replication_role = 'replica';

-- Limpar tabelas operacionais e de conteúdo usando CASCADE para limpar dependências
TRUNCATE TABLE 
    public.support_messages,
    public.support_tickets,
    public.professional_payments,
    public.costs,
    public.investor_quotas,
    public.investor_config,
    public.notebook_questions,
    public.notebooks,
    public.course_simulados,
    public.simulados, -- Se tiver dependência circular, o cascade resolve
    public.simulado_questions, -- Se existir
    public.course_items,
    public.course_materials,
    public.course_notices,
    public.apostilas,
    public.apostila_units, -- Se existir
    public.questions,
    public.enrollments,
    public.courses,
    public.assuntos,
    public.disciplinas,
    public.bancas,
    public.profiles -- Apaga usuários da tabela pública
RESTART IDENTITY CASCADE;

-- Reinserir Configurações Padrão Essenciais (se necessário)

-- 1. Configuração de Investidores
INSERT INTO public.investor_config (id, quota_value, max_quotas, return_duration_months)
VALUES (1, 100.00, 10, 12)
ON CONFLICT (id) DO NOTHING;

-- SET session_replication_role = 'origin';

COMMIT;
