-- DANGER: THIS SCRIPT WIPES ALL DATA FROM THE DATABASE
-- Use this only if you want to reset the application completely.

-- We use TRUNCATE with CASCADE to clean everything efficiently and handle foreign keys.

BEGIN;

-- 1. Operational Data (Student Activity, Payments, Support)
TRUNCATE TABLE 
    professional_payments,
    student_simulado_attempts,
    student_question_history,
    support_tickets,
    admin_messages,
    costs,
    enrollments,
    course_notices
CASCADE;

-- 2. Content Structure (Links between main content)
TRUNCATE TABLE 
    course_items,
    simulado_questions,
    course_materials
CASCADE;

-- 3. Core Content (Questions, Simulados, Materials, Courses)
TRUNCATE TABLE 
    questions,
    simulados,
    apostilas,
    courses,
    faq
CASCADE;

-- 4. Auxiliary Classifications (Tags, categories)
-- Uncomment these if you also want to wipe your categories/subjects
-- TRUNCATE TABLE bancas, disciplines, subjects CASCADE;

-- 5. Users (Profiles)
-- This wipes the public profile data.
-- You MUST also delete the users from Supabase Auth Dashboard -> Users
TRUNCATE TABLE profiles CASCADE;

COMMIT;

-- Optional: Reset ID sequences if needed (usually not needed for UUIDs)
-- RESTART IDENTITY is implicit in some SQL dialects with TRUNCATE, but UUIDs don't need reset.
