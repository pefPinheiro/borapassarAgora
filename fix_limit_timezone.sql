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
  v_start_of_day timestamptz;
BEGIN
  v_user_id := auth.uid();
  
  -- Define "Hoje" baseado no fuso horário do Brasil (America/Sao_Paulo)
  -- Converte NOW() (UTC) para horário SP, extrai a data (meia-noite), 
  -- e converte de volta para comparações se necessário, ou usa cast simples.
  -- A forma mais segura é pegar a data em SP:
  v_start_of_day := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo');

  -- Verifica se é Premium
  SELECT EXISTS (
    SELECT 1 
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.profile_id = v_user_id
    AND e.status = 'Ativo'
    AND COALESCE(c.price_offer, 0) > 0
  ) INTO v_is_premium;

  -- Conta questões respondidas desde o início do dia (Horário de Brasília)
  -- Nota: O created_at deve ser comparado considerando que ele é armazenado com Timezone.
  -- Se o servidor salva em UTC, v_start_of_day (que é um timestampTZ relativo a SP) 
  -- será convertido corretamente pelo Postgres na comparação.
  SELECT COUNT(*) INTO v_count
  FROM student_question_history
  WHERE student_id = v_user_id
  AND created_at >= v_start_of_day;

  RETURN jsonb_build_object(
    'is_premium', v_is_premium,
    'questions_today', v_count,
    'daily_limit', 20
  );
END;
$$;
