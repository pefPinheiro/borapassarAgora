-- Enable RLS on bancas table if not already enabled
ALTER TABLE public.bancas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate (avoid conflicts)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bancas;
DROP POLICY IF EXISTS "Enable insert for admins and super users" ON public.bancas;
DROP POLICY IF EXISTS "Enable update for admins and super users" ON public.bancas;
DROP POLICY IF EXISTS "Enable delete for admins and super users" ON public.bancas;
DROP POLICY IF EXISTS "Enable all access for admins and super users" ON public.bancas;

-- Policy: Everyone can view bancas
CREATE POLICY "Enable read access for all users" 
ON public.bancas FOR SELECT 
USING (true);

-- Policy: Admins and Super Admins can insert, update, delete
-- We check the 'profiles' table for the user's role
CREATE POLICY "Enable all access for admins and super users" 
ON public.bancas 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'super')
  )
);
