-- Fix Constraint Check for Status in Profiles
-- The error "profiles_status_check" means we are trying to insert a value that is not in the allowed list of the check constraint.

-- 1. Drop the restrictive constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_status_check;

-- 2. Add a new constraint that includes 'active', 'blocked', 'pendente', 'suspended', etc.
-- Or just check length, but explicit list is safer if that was the intention.
-- Based on the code, we use: 'active', 'blocked', 'pendente'
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'blocked', 'pendente', 'suspended', 'inactive'));

-- 3. (Optional) Update existing rows if they have invalid values (e.g. 'Ativo' -> 'active')
UPDATE public.profiles SET status = 'active' WHERE status = 'Ativo';
UPDATE public.profiles SET status = 'blocked' WHERE status = 'Inativo';
UPDATE public.profiles SET status = 'pendente' WHERE status = 'Pendente';
