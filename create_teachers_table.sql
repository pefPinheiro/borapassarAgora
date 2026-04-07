-- Criar tabela de professores
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    disciplines_ids UUID[] DEFAULT '{}',
    ad_images TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Professors are viewable by everyone" ON teachers
    FOR SELECT USING (true);

CREATE POLICY "Allow all for admins and super" ON teachers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super')
        )
    );
