-- Enable RLS
ALTER TABLE public.apostilas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable all access for super and admin" ON public.apostilas;
DROP POLICY IF EXISTS "Enable read access for all unit" ON public.apostilas;
DROP POLICY IF EXISTS "Enable update for associated professor" ON public.apostilas;
DROP POLICY IF EXISTS "Enable insert for teachers" ON public.apostilas;
DROP POLICY IF EXISTS "Enable update for editors" ON public.apostilas;

-- 1. Read access for all authenticated users (students need to read)
CREATE POLICY "Enable read for authenticated users"
ON public.apostilas FOR SELECT
TO authenticated
USING (true);

-- 2. Full access for super and admin roles
CREATE POLICY "Super and admin full access"
ON public.apostilas FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'super' OR role = 'admin')
  )
);

-- 3. Teachers can INSERT apostilas
CREATE POLICY "Teachers can insert apostilas"
ON public.apostilas FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  )
);

-- 4. Teachers can UPDATE apostilas they are assigned to or that they authored
CREATE POLICY "Teachers can update assigned apostilas"
ON public.apostilas FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.teachers t ON t.linked_profile_id = p.id
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'teacher' 
      AND (
        public.apostilas.author_id = p.id -- User is the author
        OR public.apostilas.professor_id = t.id -- User is the linked professor
        OR public.apostilas.assigned_editor_id = p.id -- User is the assigned editor
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.teachers t ON t.linked_profile_id = p.id
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'teacher' 
      AND (
        public.apostilas.author_id = p.id
        OR public.apostilas.professor_id = t.id
        OR public.apostilas.assigned_editor_id = p.id
      )
    )
  )
);

-- 5. Similar policy for DELETE if needed (Professors probably shouldn't delete, only Super/Admin)
-- For now, let's stick to update/insert as requested for "salvar".
