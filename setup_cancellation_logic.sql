-- Function to handle commission cancellation/reversal when Enrollment is Cancelled
CREATE OR REPLACE FUNCTION handle_enrollment_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    r_payment record;
BEGIN
    -- Check if status changed to Cancelado or Reembolsado/Refunded
    -- We assume 'Cancelado' is the main status for cancellation in the system.
    IF (NEW.status IN ('Cancelado', 'Reembolsado', 'Totalmente Reembolsado')) 
       AND (OLD.status IS DISTINCT FROM NEW.status) THEN
       
       -- Loop through existing payments linked to this enrollment
       FOR r_payment IN
           SELECT * FROM professional_payments 
           WHERE enrollment_id = NEW.id
       LOOP
           -- Case 1: Payment is still Pending (Comission within 7 days usually)
           -- We simply mark it as Cancelled so it is not paid.
           IF r_payment.status = 'Pendente' THEN
               UPDATE professional_payments 
               SET status = 'Cancelado',
                   description = description || ' [Cancelado - Matrícula Encerrada]'
               WHERE id = r_payment.id;
           
           -- Case 2: Payment was already Paid (Rare for 7 days, but possible manually)
           -- We create a NEGATIVE record (Chargeback/Estorno) to preserve history and balance the account.
           ELSIF r_payment.status = 'Pago' THEN
               INSERT INTO professional_payments (
                   user_id,
                   amount,
                   status,
                   due_date,
                   type,
                   description,
                   enrollment_id,
                   course_id,
                   created_at
               ) VALUES (
                   r_payment.user_id,
                   -- Negative amount to deduct from future payments
                   -r_payment.amount, 
                   'Pendente', -- It stays pending until "paid" (deducted) from a future settlement
                   CURRENT_DATE,
                   'Estorno',
                   'Estorno/Reembolso: ' || r_payment.description,
                   NEW.id,
                   NEW.course_id,
                   NOW()
               );
           END IF;
       END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_enrollment_cancellation ON enrollments;

-- Create Trigger
CREATE TRIGGER on_enrollment_cancellation
AFTER UPDATE ON enrollments
FOR EACH ROW
EXECUTE FUNCTION handle_enrollment_cancellation();

-- NOTE: The UI update in PagamentosAdmin.tsx (Warning Banner) was already present in the codebase reading
-- but we ensure the backend logic now actively enforces it.
