-- Script para remover permanentemente o módulo Mapa Interativo Pro e suas dependências
-- ATENÇÃO: Esta ação é irreversível e excluirá todos os dados de mapas e avatares.

-- 1. Remover tabelas do módulo
DROP TABLE IF EXISTS "public"."mapas_interativos" CASCADE;
DROP TABLE IF EXISTS "public"."avatars" CASCADE;

-- 2. Limpar referências em permissões (opcional, dependendo de como você gerencia RLS)
-- Se você tiver políticas específicas baseadas nestas tabelas, o CASCADE acima cuidará disso.

-- 3. Caso tenha criado algum tipo ENUM específico para este módulo (ex: tipos de figuras)
-- DROP TYPE IF EXISTS public.mapa_shape;
