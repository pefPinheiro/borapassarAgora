CREATE TABLE IF NOT EXISTS simulado_disciplina_weights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    simulado_id UUID REFERENCES simulados(id) ON DELETE CASCADE,
    disciplina_id UUID REFERENCES disciplinas(id) ON DELETE CASCADE,
    weight NUMERIC DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(simulado_id, disciplina_id)
);

ALTER TABLE simulado_disciplina_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select weights" ON simulado_disciplina_weights;
DROP POLICY IF EXISTS "Admin manage weights" ON simulado_disciplina_weights;

CREATE POLICY "Public select weights" ON simulado_disciplina_weights FOR SELECT USING (true);
CREATE POLICY "Admin manage weights" ON simulado_disciplina_weights FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super', 'editor', 'teacher'))
);
