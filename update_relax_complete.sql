-- 1. Ensure Wallet Column Exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS boras_wallet INTEGER DEFAULT 0;

-- 2. Ensure Game History Table Exists
CREATE TABLE IF NOT EXISTS relax_game_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL, 
    game_type TEXT NOT NULL, -- 'million_challenge', etc
    score INTEGER NOT NULL DEFAULT 0, -- Pontos/Moedas ganhos
    details JSONB, -- Detalhes da partida (nivel alcançado, ajudas usadas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for high scores
CREATE INDEX IF NOT EXISTS idx_relax_history_user_score ON relax_game_history(user_id, score DESC);

-- RLS for Game History
ALTER TABLE relax_game_history ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relax_game_history' AND policyname = 'Users can view own game history') THEN
        CREATE POLICY "Users can view own game history" ON relax_game_history FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relax_game_history' AND policyname = 'Users can insert own game history') THEN
        CREATE POLICY "Users can insert own game history" ON relax_game_history FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Wallet Update Function (Security Definer to bypass RLS if needed for profile updates by self if logic requires)
CREATE OR REPLACE FUNCTION update_boras_wallet(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    UPDATE profiles
    SET boras_wallet = COALESCE(boras_wallet, 0) + p_amount
    WHERE id = p_user_id
    RETURNING boras_wallet INTO new_balance;
    
    RETURN new_balance;
END;
$$;

-- 4. Ranking Function
CREATE OR REPLACE FUNCTION get_game_ranking(p_course_id UUID, p_game_type TEXT)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    total_score BIGINT 
)
LANGUAGE plpgsql
SECURITY DEFINER 
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
