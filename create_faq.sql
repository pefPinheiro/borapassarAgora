-- Tabela de FAQ
CREATE TABLE IF NOT EXISTS faq (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pergunta text NOT NULL,
    resposta text NOT NULL,
    categoria text NOT NULL,
    status text DEFAULT 'Ativo',
    created_at timestamp with time zone DEFAULT now()
);

-- RLS para FAQ
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;

-- Permite leitura pública de FAQs ativos
CREATE POLICY "Public can read active faq" ON faq
    FOR SELECT USING (status = 'Ativo');

-- Permite acesso total para autenticados (simplificado para admins neste contexto)
CREATE POLICY "Full access for authenticated" ON faq
    FOR ALL USING (auth.role() = 'authenticated');
