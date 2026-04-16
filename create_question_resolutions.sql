-- Criar tabela para salvar as resoluções dos professores
CREATE TABLE IF NOT EXISTS question_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    questions TEXT[] DEFAULT '{}',
    disciplina_id UUID REFERENCES disciplinas(id),
    assunto_id UUID REFERENCES assuntos(id),
    subassunto_id UUID REFERENCES subassuntos(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE question_resolutions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can manage their own resolutions" ON question_resolutions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins and Supers can see all" ON question_resolutions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super')
        )
    );
