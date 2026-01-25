
-- Garantir que a tabela de Enrollments existe e tem as colunas corretas
CREATE TABLE IF NOT EXISTS enrollments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'Ativo', -- Ativo, Cancelado, Expirado
    progress int DEFAULT 0,
    payment_method text, -- pix, card, boleto
    amount_paid numeric(10, 2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso

-- Alunos podem ver suas próprias inscrições
CREATE POLICY "Alunos ver proprias inscricoes" ON enrollments
    FOR SELECT USING (auth.uid() = profile_id);

-- Alunos podem criar inscrições (compra/grátis)
CREATE POLICY "Alunos criar inscricoes" ON enrollments
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Admins podem ver todas as inscrições
CREATE POLICY "Admins ver todas inscricoes" ON enrollments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'super'))
    );

-- Habilitar Realtime para a tabela enrollments (para o Admin ver chegando)
alter publication supabase_realtime add table enrollments;
