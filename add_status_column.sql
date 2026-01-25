-- Add status column to investor_quotas if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_quotas' AND column_name = 'status') THEN
        ALTER TABLE public.investor_quotas ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Update RLS policies to allow updates to status
ALTER TABLE public.investor_quotas ENABLE ROW LEVEL SECURITY;

-- Ensure super admin can update everything
CREATE POLICY "Super admin full access" ON public.investor_quotas
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super'
    )
);

-- Ensure admins can read their own data and insert pending requests
CREATE POLICY "Admins can view own quotas" ON public.investor_quotas
FOR SELECT
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super'))
);

CREATE POLICY "Admins can insert pending quotas" ON public.investor_quotas
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

-- Reload schema cache in Supabase logic (usually by just re-running queries, but this migration ensures DB Structure)
NOTIFY pgrst, 'reload schema';
