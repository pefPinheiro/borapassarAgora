-- Function to get top 10 ranking for a specific game and course
CREATE OR REPLACE FUNCTION get_game_ranking(p_course_id UUID, p_game_type TEXT)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    total_score BIGINT -- Use BIGINT to avoid overflow on sum
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to allow reading all scores
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.full_name,
        p.avatar_url,
        SUM(gh.score)::BIGINT as total_score
    FROM relax_game_history gh
    JOIN profiles p ON p.id = gh.user_id
    WHERE gh.course_id = p_course_id
      AND gh.game_type = p_game_type
    GROUP BY p.id, p.full_name, p.avatar_url
    ORDER BY total_score DESC
    LIMIT 10;
END;
$$;
