
-- Adicionar carteira de Boras ao perfil
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS boras_wallet INTEGER DEFAULT 0;

-- Tabela de Histórico de Partidas do Relax
CREATE TABLE IF NOT EXISTS relax_game_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL, 
    game_type TEXT NOT NULL, -- 'million_challenge', etc
    score INTEGER NOT NULL DEFAULT 0, -- Pontos/Moedas ganhos
    details JSONB, -- Detalhes da partida (nivel alcançado, ajudas usadas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice para facilitar busca de maior pontuação
CREATE INDEX IF NOT EXISTS idx_relax_history_user_score ON relax_game_history(user_id, score DESC);

-- Habilitar RLS
ALTER TABLE relax_game_history ENABLE ROW LEVEL SECURITY;

-- Politica: Usuario vê seus jogos
CREATE POLICY "Users can view own game history" ON relax_game_history
    FOR SELECT USING (auth.uid() = user_id);

-- Politica: Usuario cria registros de jogo
CREATE POLICY "Users can insert own game history" ON relax_game_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RPC para debitar/creditar Boras com segurança
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
