-- Update profile roles to include necessary staff roles for the application logic
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('student', 'admin', 'super', 'collaborator', 'editor', 'teacher', 'moderator'));

COMMENT ON CONSTRAINT profiles_role_check ON public.profiles IS 'Permite roles específicos para staff e alunos.';
