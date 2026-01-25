
CREATE TABLE IF NOT EXISTS student_simulado_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES auth.users(id) NOT NULL,
    simulado_id uuid REFERENCES simulados(id) NOT NULL,
    correct int DEFAULT 0,
    wrong int DEFAULT 0,
    blank int DEFAULT 0,
    net_score numeric(5,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE student_simulado_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attempts" ON student_simulado_attempts
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Users can insert their own attempts" ON student_simulado_attempts
    FOR INSERT WITH CHECK (auth.uid() = student_id);
