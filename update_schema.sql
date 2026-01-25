-- Execute este comando no Editor SQL do seu projeto no Supabase
-- para criar a coluna necessária para o Tempo Estimado.

ALTER TABLE apostilas ADD COLUMN IF NOT EXISTS estimated_time text;

-- Create table to track user history on questions (Resolved/Unresolved)
CREATE TABLE IF NOT EXISTS student_question_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES auth.users(id) NOT NULL,
    question_id uuid REFERENCES questions(id) NOT NULL,
    selected_alternative_index int,
    is_correct boolean,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(student_id, question_id)
);

-- Policy (Optional if RLS is enabled, but good practice)
ALTER TABLE student_question_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON student_question_history
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Users can insert own history" ON student_question_history
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can update own history" ON student_question_history
    FOR UPDATE USING (auth.uid() = student_id);

-- Tabela de Histórico de Simulados
CREATE TABLE IF NOT EXISTS student_simulado_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES auth.users(id) NOT NULL,
    simulado_id uuid REFERENCES simulados(id) NOT NULL,
    correct int DEFAULT 0,
    wrong int DEFAULT 0,
    blank int DEFAULT 0,
    net_score numeric(5,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS para Simulados
ALTER TABLE student_simulado_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attempts" ON student_simulado_attempts
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Users can insert their own attempts" ON student_simulado_attempts
    FOR INSERT WITH CHECK (auth.uid() = student_id);


-- Tabela de FAQ (Adicionado recentemente)
CREATE TABLE IF NOT EXISTS faq (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pergunta text NOT NULL,
    resposta text NOT NULL,
    categoria text NOT NULL,
    status text DEFAULT 'Ativo',
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE faq ENABLE ROW LEVEL SECURITY;

-- Permite leitura pública de FAQs ativos
CREATE POLICY "Public can read active faq" ON faq
    FOR SELECT USING (status = 'Ativo');

-- Permite acesso total para autenticados (Admin/Colaboradores)
CREATE POLICY "Full access for authenticated" ON faq
    FOR ALL USING (auth.role() = 'authenticated');
