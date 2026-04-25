ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS study_plan_json JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS study_plan_progress JSONB DEFAULT '{}'::jsonb;
