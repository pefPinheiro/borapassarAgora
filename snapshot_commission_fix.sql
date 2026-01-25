-- 1. Add snapshot column to professional_payments table
ALTER TABLE professional_payments ADD COLUMN IF NOT EXISTS snapshot_total_apostilas INTEGER;

-- 2. Update the Commission Calculation Logic to save the snapshot
CREATE OR REPLACE FUNCTION public.handle_new_enrollment_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_total_apostilas int;
    v_general_collaborators int;
    v_total_parts int;
    v_unit_value numeric;
    
    r_author record;
    r_colab record;
    
    v_author_apostilas int;
    v_payment_amount numeric;
    v_due_date date;
    
    v_course_title text;
    v_commission_perc int;
    v_distributable_amount numeric;
BEGIN
    -- Check if paid course
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
        RETURN NEW;
    END IF;

    -- Get course details: title and commission percentage
    SELECT title, COALESCE(commission_percentage, 50) 
    INTO v_course_title, v_commission_perc 
    FROM courses 
    WHERE id = NEW.course_id;

    -- Calculate total distributable amount based on course settings
    v_distributable_amount := NEW.amount_paid * (v_commission_perc::numeric / 100.0);

    -- Get total apostilas count for the course
    SELECT count(*) INTO v_total_apostilas
    FROM course_items
    WHERE course_id = NEW.course_id;
    
    -- Get total general collaborators (commissioned but not necessarily authors)
    -- We assume any profile marked with 'receive_general_commission' gets 1 part
    SELECT count(*) INTO v_general_collaborators
    FROM profiles
    WHERE receive_general_commission = TRUE;

    -- Calculate Total Parts (Denominator)
    -- Parts = Total Apostilas + Total General Collaborators
    v_total_parts := v_total_apostilas + v_general_collaborators;

    -- If no parts to distribute, exit
    IF v_total_parts = 0 THEN
        RETURN NEW;
    END IF;

    -- Calculate Value per Part (Unit Value)
    v_unit_value := v_distributable_amount / v_total_parts;

    -- Define Due Date (1st of next month)
    v_due_date := date_trunc('month', now()) + interval '1 month';


    -- A. DISTRIBUTE TO AUTHORS (1 Part per Apostila)
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

        -- Calculate total for this author based on their apostilas
        v_payment_amount := v_author_apostilas * v_unit_value;

        IF v_payment_amount > 0 THEN
            INSERT INTO professional_payments (
                user_id,
                amount,
                status,
                due_date,
                type,
                description,
                enrollment_id,
                course_id,
                snapshot_total_apostilas -- SAVING SNAPSHOT
            ) VALUES (
                r_author.author_id,
                v_payment_amount,
                'Pendente',
                v_due_date,
                'Comissão',
                'Comissão Apostilas (' || v_author_apostilas || '): ' || COALESCE(v_course_title, 'Curso'),
                NEW.id,
                NEW.course_id,
                v_total_apostilas -- VALUE
            );
        END IF;
    END LOOP;


    -- B. DISTRIBUTE TO GENERAL COLLABORATORS (1 Part Fixed)
    -- Loop through general collaborators
    -- Note: If a user is BOTH an author and a general collaborator, they receive BOTH payments independently.
    FOR r_colab IN
        SELECT id 
        FROM profiles 
        WHERE receive_general_commission = TRUE
    LOOP
        INSERT INTO professional_payments (
            user_id,
            amount,
            status,
            due_date,
            type,
            description,
            enrollment_id,
            course_id,
            snapshot_total_apostilas -- SAVING SNAPSHOT (Event though it matters less here, good for context)
        ) VALUES (
            r_colab.id,
            v_unit_value, -- 1 Part Fixed
            'Pendente',
            v_due_date,
            'Comissão',
            'Comissão Colaborador: ' || COALESCE(v_course_title, 'Curso'),
            NEW.id,
            NEW.course_id,
            v_total_apostilas
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
