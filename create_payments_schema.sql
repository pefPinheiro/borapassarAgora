-- Create table for professional payments
CREATE TABLE IF NOT EXISTS professional_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) NOT NULL,
    amount numeric(10, 2) NOT NULL,
    status text DEFAULT 'Pendente', -- 'Pendente', 'Pago'
    due_date date NOT NULL,
    type text DEFAULT 'Comissão', -- 'Comissão', 'Fixo', 'Outros'
    description text,
    enrollment_id uuid REFERENCES enrollments(id), -- Nullable for manual entries
    course_id uuid REFERENCES courses(id), -- Nullable for manual entries
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE professional_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins full access payments" ON professional_payments 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'super'))
    );

CREATE POLICY "Users view own payments" ON professional_payments 
    FOR SELECT USING (auth.uid() = user_id);

-- Trigger Function for Commission Calculation
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
BEGIN
    -- Check if paid course
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
        RETURN NEW;
    END IF;

    -- Get total apostilas count for the course and course title for description
    SELECT count(*) INTO v_total_apostilas
    FROM course_items
    WHERE course_id = NEW.course_id;
    
    SELECT title INTO v_course_title FROM courses WHERE id = NEW.course_id;

    -- If no apostilas, no commission
    IF v_total_apostilas = 0 THEN
        RETURN NEW;
    END IF;

    -- Calculate Value per Apostila
    -- VALOR_APOSTILA = (VALOR_CURSO/2) * (1/TOTAL_APOSTILAS_CURSO)
    v_apostila_value := (NEW.amount_paid / 2.0) / v_total_apostilas;

    -- Define Due Date (1st of next month)
    v_due_date := date_trunc('month', now()) + interval '1 month';

    -- Loop through each author in the course
    FOR r_author IN
        SELECT DISTINCT a.author_id
        FROM course_items ci
        JOIN apostilas a ON a.id = ci.apostila_id
        WHERE ci.course_id = NEW.course_id AND a.author_id IS NOT NULL
    LOOP
        -- Count apostilas for this author in this course
        SELECT count(*) INTO v_author_apostilas
        FROM course_items ci
        JOIN apostilas a ON a.id = ci.apostila_id
        WHERE ci.course_id = NEW.course_id AND a.author_id = r_author.author_id;

        -- Calculate total received
        v_payment_amount := v_author_apostilas * v_apostila_value;

        -- Insert Payment Record
        INSERT INTO professional_payments (
            user_id,
            amount,
            status,
            due_date,
            type,
            description,
            enrollment_id,
            course_id
        ) VALUES (
            r_author.author_id,
            v_payment_amount,
            'Pendente',
            v_due_date,
            'Comissão',
            'Comissão Venda: ' || COALESCE(v_course_title, 'Curso'),
            NEW.id,
            NEW.course_id
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS on_enrollment_commission ON enrollments;
CREATE TRIGGER on_enrollment_commission
AFTER INSERT ON enrollments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_enrollment_commission();
