
-- Verifica e corrige a tabela profiles
-- Adiciona a coluna email se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email text;
    END IF;
END $$;

-- Garante que o trigger de novos usuários preencha o email
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

-- Atualiza emails vazios na tabela profiles pegando da auth.users (fix retroativo)
-- Isso requer permissão de superusuário ou proprietário.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
