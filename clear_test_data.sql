-- WARNING: THIS SCRIPT DELETES DATA. USE WITH CAUTION.
-- Removes enrollment data, payments, and history for test users.

-- 1. DELETE COMMISSIONS/PAYMENTS (Dependent on Enrollments)
DELETE FROM professional_payments;

-- 2. DELETE STUDENT HISTORY (Dependent on Users/Simulados)
DELETE FROM student_simulado_attempts;
DELETE FROM student_question_history;

-- 3. DELETE ENROLLMENTS (Purchases)
-- This removes the link between users and courses.
DELETE FROM enrollments;

-- 4. DELETE STUDENT PROFILES (Optional)
-- WARNING: This deletes the public profile data.
-- Even if you delete public profiles, the 'auth.users' entry remains in Supabase Auth.
-- To completely remove a user, delete them from the Supabase Dashboard > Authentication > Users.
-- The standard way is to assume cascading deletes, but to be sure we clean orphaned profiles:

DELETE FROM profiles 
WHERE role = 'student' 
   OR role IS NULL 
   OR email LIKE '%test%'; 

-- NOTE: If you have specific test users you want to target, check their emails first.
