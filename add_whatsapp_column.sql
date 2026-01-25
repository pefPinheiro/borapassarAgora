-- Add is_whatsapp column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_whatsapp boolean DEFAULT false;
