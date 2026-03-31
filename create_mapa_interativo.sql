-- Create Avatars table
CREATE TABLE IF NOT EXISTS avatars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    imagem_url TEXT NOT NULL,
    disciplina_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL,
    assunto_id UUID REFERENCES assuntos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Mapas Interativos table
CREATE TABLE IF NOT EXISTS mapas_interativos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    avatar_id UUID REFERENCES avatars(id) ON DELETE SET NULL,
    workflow_json JSONB NOT NULL,
    disciplina_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL,
    assunto_id UUID REFERENCES assuntos(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapas_interativos ENABLE ROW LEVEL SECURITY;

-- Create Policies (assuming similar to other tables)
CREATE POLICY "Enable read access for all users" ON avatars FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON avatars FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON mapas_interativos FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON mapas_interativos FOR ALL USING (true);

-- Note: More specific RLS can be added if needed, but for now we follow the general pattern.
