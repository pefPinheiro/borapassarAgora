-- Fix Enrollments RLS and Foreign Keys

-- 1. Ensure Table Structure is Correct
ALTER TABLE enrollments
DROP CONSTRAINT IF EXISTS enrollments_profile_id_fkey,
ADD CONSTRAINT enrollments_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE enrollments 
DROP CONSTRAINT IF EXISTS enrollments_course_id_fkey,
ADD CONSTRAINT enrollments_course_id_fkey
    FOREIGN KEY (course_id)
    REFERENCES courses(id)
    ON DELETE CASCADE;

-- 2. Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- 3. Drop possibly conflicting policies
DROP POLICY IF EXISTS "Alunos ver proprias inscricoes" ON enrollments;
DROP POLICY IF EXISTS "Alunos criar inscricoes" ON enrollments;
DROP POLICY IF EXISTS "Admins ver todas inscricoes" ON enrollments;
DROP POLICY IF EXISTS "Admins full access" ON enrollments;

-- 4. Re-create Optimized Policies

-- Allow students to VIEW their own enrollments
CREATE POLICY "Alunos ver proprias inscricoes" ON enrollments
    FOR SELECT USING (auth.uid() = profile_id);

-- Allow students to INSERT their own enrollments (Crucial for Checkout)
-- KEY FIX: The 'With Check' must match the auth.uid() against the inserted profile_id
CREATE POLICY "Alunos criar inscricoes" ON enrollments
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Allow Admins full access (using the secure function if available, fallback to subquery)
CREATE POLICY "Admins full access" ON enrollments
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super')
    );

-- 5. Ensure Trigger for Commissions exists (Safe Re-creation)
CREATE OR REPLACE FUNCTION public.handle_new_enrollment_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_total_apostilas int;
    v_apostila_value numeric;
    r_author record;
    v_author_apostilas int;
    v_payment_amount numeric;
    v_due_date date;
    v_course_title text;
    v_has_commissions boolean := false;
BEGIN
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
        RETURN NEW;
    END IF;

    SELECT count(*) INTO v_total_apostilas FROM course_items WHERE course_id = NEW.course_id;
    SELECT title INTO v_course_title FROM courses WHERE id = NEW.course_id;

    IF v_total_apostilas = 0 THEN
        RETURN NEW;
    END IF;

    v_apostila_value := (NEW.amount_paid / 2.0) / v_total_apostilas;
    v_due_date := date_trunc('month', now()) + interval '1 month';

    FOR r_author IN
        SELECT DISTINCT a.author_id
        FROM course_items ci
        JOIN apostilas a ON a.id = ci.apostila_id
        WHERE ci.course_id = NEW.course_id AND a.author_id IS NOT NULL
    LOOP
        SELECT count(*) INTO v_author_apostilas
        FROM course_items ci
        JOIN apostilas a ON a.id = ci.apostila_id
        WHERE ci.course_id = NEW.course_id AND a.author_id = r_author.author_id;

        v_payment_amount := v_author_apostilas * v_apostila_value;

        INSERT INTO professional_payments (
            user_id, amount, status, due_date, type, description, enrollment_id, course_id
        ) VALUES (
            r_author.author_id, v_payment_amount, 'Pendente', v_due_date, 'Comissão',
            'Comissão Venda: ' || COALESCE(v_course_title, 'Curso'), NEW.id, NEW.course_id
        );
        v_has_commissions := true;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block enrollment
    RAISE WARNING 'Error calculating commission for enrollment %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_enrollment_commission ON enrollments;
CREATE TRIGGER on_enrollment_commission
AFTER INSERT ON enrollments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_enrollment_commission();
