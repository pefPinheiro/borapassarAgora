-- Create option for "View All Payments" access
-- Add a new column to profiles to store if the user can see all payments or just their own.
-- "can_view_all_payments": boolean default false

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS view_all_payments boolean DEFAULT false;

-- Update the comments/docs to reflect this new permission flag
COMMENT ON COLUMN public.profiles.view_all_payments IS 'Se true, o colaborador pode ver pagamentos de TODOS no módulo Pagamentos Prof.';
