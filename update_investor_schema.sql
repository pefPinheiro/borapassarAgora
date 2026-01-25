-- 1. Courses update: Add investor_percentage
ALTER TABLE courses ADD COLUMN IF NOT EXISTS investor_percentage numeric DEFAULT 0;

-- 2. Profiles update: Add is_investor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_investor boolean DEFAULT false;

-- 3. Investor Config Table
CREATE TABLE IF NOT EXISTS investor_config (
    id int PRIMARY KEY DEFAULT 1,
    quota_value numeric NOT NULL DEFAULT 100.00,
    max_quotas int NOT NULL DEFAULT 10,
    return_duration_months int NOT NULL DEFAULT 12,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initial Seed for Config
INSERT INTO investor_config (id, quota_value, max_quotas, return_duration_months)
VALUES (1, 100.00, 10, 12)
ON CONFLICT (id) DO NOTHING;

-- 4. Investor Quotas Table
CREATE TABLE IF NOT EXISTS investor_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    amount_paid numeric NOT NULL, -- The investment amount
    total_received numeric DEFAULT 0, -- Value recovered so far
    roi_date timestamp with time zone, -- When investment was fully recovered
    created_at timestamp with time zone DEFAULT now()
);

-- RLS Policies
ALTER TABLE investor_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage investor quotas" ON investor_quotas;
CREATE POLICY "Admins manage investor quotas" ON investor_quotas
FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super'))
);

DROP POLICY IF EXISTS "Admins manage investor config" ON investor_config;
CREATE POLICY "Admins manage investor config" ON investor_config
FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super'))
);

-- Updated Logic Function
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
    v_investor_perc int;
    v_distributable_amount numeric;
    v_investor_pool numeric;
    
    -- Investor Vars
    v_total_active_quotas int;
    r_investor record;
    v_investor_amount numeric;
    v_config_duration int;
    v_quota_value_unit numeric;
BEGIN
    -- Check if paid course
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
        RETURN NEW;
    END IF;

    -- Get course details: title, commission (apostilas), investor percentage
    SELECT title, COALESCE(commission_percentage, 50), COALESCE(investor_percentage, 0)
    INTO v_course_title, v_commission_perc, v_investor_perc
    FROM courses 
    WHERE id = NEW.course_id;

    -- Define Due Date (1st of next month)
    v_due_date := date_trunc('month', now()) + interval '1 month';

    -- =================================================================================
    -- 1. APOSTILA / GENERAL COMMISSION (Existing Logic)
    -- =================================================================================
    
    -- Calculate commission pool
    v_distributable_amount := NEW.amount_paid * (v_commission_perc::numeric / 100.0);

    SELECT count(*) INTO v_total_apostilas FROM course_items WHERE course_id = NEW.course_id;
    SELECT count(*) INTO v_general_collaborators FROM profiles WHERE receive_general_commission = TRUE;
    v_total_parts := v_total_apostilas + v_general_collaborators;

    IF v_total_parts > 0 THEN
        v_unit_value := v_distributable_amount / v_total_parts;

        -- Authors
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

            v_payment_amount := v_author_apostilas * v_unit_value;

            IF v_payment_amount > 0 THEN
                INSERT INTO professional_payments (user_id, amount, status, due_date, type, description, enrollment_id, course_id)
                VALUES (r_author.author_id, v_payment_amount, 'Pendente', v_due_date, 'Comissão', 'Comissão Apostilas (' || v_author_apostilas || '): ' || v_course_title, NEW.id, NEW.course_id);
            END IF;
        END LOOP;

        -- General Collaborators
        FOR r_colab IN SELECT id FROM profiles WHERE receive_general_commission = TRUE LOOP
            INSERT INTO professional_payments (user_id, amount, status, due_date, type, description, enrollment_id, course_id)
            VALUES (r_colab.id, v_unit_value, 'Pendente', v_due_date, 'Comissão', 'Comissão Colaborador: ' || v_course_title, NEW.id, NEW.course_id);
        END LOOP;
    END IF;

    -- =================================================================================
    -- 2. INVESTOR COMMISSION (New Logic)
    -- =================================================================================
    
    IF v_investor_perc > 0 THEN
        v_investor_pool := NEW.amount_paid * (v_investor_perc::numeric / 100.0);
        
        -- Get Duration from Config
        SELECT return_duration_months INTO v_config_duration FROM investor_config LIMIT 1;
        -- Default to 12 if missing
        IF v_config_duration IS NULL THEN v_config_duration := 12; END IF;
        
        -- Find Total Active Quotas
        -- Active = (roi_date IS NULL) OR (roi_date + interval duration > now())
        SELECT COALESCE(SUM(quantity), 0) INTO v_total_active_quotas
        FROM investor_quotas
        WHERE (roi_date IS NULL OR (roi_date + (v_config_duration || ' months')::interval) > NOW());
        
        IF v_total_active_quotas > 0 THEN
            v_quota_value_unit := v_investor_pool / v_total_active_quotas;
            
            FOR r_investor IN 
                SELECT id, user_id, quantity, amount_paid, total_received, roi_date
                FROM investor_quotas
                WHERE (roi_date IS NULL OR (roi_date + (v_config_duration || ' months')::interval) > NOW())
            LOOP
                v_investor_amount := r_investor.quantity * v_quota_value_unit;
                
                -- Create Payment
                INSERT INTO professional_payments (user_id, amount, status, due_date, type, description, enrollment_id, course_id)
                VALUES (r_investor.user_id, v_investor_amount, 'Pendente', v_due_date, 'Dividendo', 'Investidor (' || r_investor.quantity || ' cotas): ' || v_course_title, NEW.id, NEW.course_id);
                
                -- Update Quota Stats
                UPDATE investor_quotas 
                SET total_received = total_received + v_investor_amount
                WHERE id = r_investor.id;
                
                -- Check ROI (Only if not already hit)
                -- Need to re-fetch to ensure we use the updated value or just use local logic.
                IF r_investor.roi_date IS NULL AND (r_investor.total_received + v_investor_amount) >= r_investor.amount_paid THEN
                    UPDATE investor_quotas SET roi_date = NOW() WHERE id = r_investor.id;
                END IF;
                
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
