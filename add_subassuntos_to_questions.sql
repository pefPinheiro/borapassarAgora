-- Adicionar colunas de subassunto e subsubassunto à tabela de questões
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subassunto_id uuid REFERENCES subassuntos(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subsubassunto_id uuid REFERENCES subsubassuntos(id) ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_questions_subassunto_id ON questions(subassunto_id);
CREATE INDEX IF NOT EXISTS idx_questions_subsubassunto_id ON questions(subsubassunto_id);

-- Atualizar o cache do schema
NOTIFY pgrst, 'reload schema';
