
CREATE TABLE IF NOT EXISTS notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  discipline_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES assuntos(id) ON DELETE SET NULL,
  apostila_id UUID REFERENCES apostilas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notebook_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL, 
  explanation TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_questions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notebooks' AND policyname = 'Read notebooks') THEN
    CREATE POLICY "Read notebooks" ON notebooks FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notebooks' AND policyname = 'Manage notebooks') THEN
    CREATE POLICY "Manage notebooks" ON notebooks USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super', 'admin', 'editor', 'teacher')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notebook_questions' AND policyname = 'Read notebook questions') THEN
    CREATE POLICY "Read notebook questions" ON notebook_questions FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notebook_questions' AND policyname = 'Manage notebook questions') THEN
    CREATE POLICY "Manage notebook questions" ON notebook_questions USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super', 'admin', 'editor', 'teacher')));
  END IF;
END $$;
