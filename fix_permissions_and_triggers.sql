
-- Tabela de Perfis Públicos (profiles) - Se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone,
  full_name text,
  email text,
  avatar_url text,
  website text,
  role text DEFAULT 'student',
  status text DEFAULT 'active'
);

-- Trigger para criar perfil automaticamente ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = COALESCE(EXCLUDED.role, profiles.role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: se não existe, cria
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END
$$;

-- Grant permissions (importante se RLS estiver bloqueando até a criação)
GRANT ALL ON TABLE public.profiles TO postgres;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

--------------------------------------------------------------------------------
-- Tabela de Enrollments (Inscrições)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- Policies (Regras de Segurança)
--------------------------------------------------------------------------------

-- Profiles: Cada um ver o seu, ou Admin ver todos
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING ( auth.uid() = id );
CREATE POLICY "Admins view all profiles" ON profiles FOR SELECT USING (
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING ( auth.uid() = id );

-- Enrollments: Alunos veem as suas, Admins veem todas
DROP POLICY IF EXISTS "Alunos ver proprias inscricoes" ON enrollments;
DROP POLICY IF EXISTS "Alunos criar inscricoes" ON enrollments;
DROP POLICY IF EXISTS "Admins ver todas inscricoes" ON enrollments;

-- Policy Aluno: Ver
CREATE POLICY "Alunos ver proprias inscricoes" ON enrollments
    FOR SELECT USING (auth.uid() = profile_id);

-- Policy Aluno: Criar
CREATE POLICY "Alunos criar inscricoes" ON enrollments
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Policy Admin: Ver TUDO
CREATE POLICY "Admins ver todas inscricoes" ON enrollments
    FOR ALL USING (
         (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
         (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Habilitar Realtime para Enrollments (Importante para o Admin ver chegando)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'enrollments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE enrollments;
  END IF;
END
$$;
