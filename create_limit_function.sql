CREATE OR REPLACE FUNCTION public.get_student_daily_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_premium boolean;
  v_count integer;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user has any active paid course (price_offer > 0)
  -- Assumes 'Ativo' is the status for active enrollments
  SELECT EXISTS (
    SELECT 1 
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.profile_id = v_user_id
    AND e.status = 'Ativo'
    AND COALESCE(c.price_offer, 0) > 0
  ) INTO v_is_premium;

  -- Count questions answered today
  -- Uses CURRENT_DATE (server time). Adjust logic if timezone support is critical.
  SELECT COUNT(*) INTO v_count
  FROM student_question_history
  WHERE student_id = v_user_id
  AND created_at >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'is_premium', v_is_premium,
    'questions_today', v_count,
    'daily_limit', 20
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_daily_status TO authenticated;
