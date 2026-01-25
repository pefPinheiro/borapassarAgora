CREATE TABLE IF NOT EXISTS costs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    description text NOT NULL,
    amount numeric(10, 2) NOT NULL,
    category text NOT NULL, -- 'Recurso', 'Aquisição', 'Serviço', 'Marketing', 'Outros'
    payment_date date NOT NULL,
    recurrence text DEFAULT 'Único', -- 'Único', 'Mensal', 'Anual'
    status text DEFAULT 'Pendente', -- 'Pago', 'Pendente'
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Apenas Admins)
-- Nota: Ajuste a verificação de role conforme sua tabela profiles. Geralmente é 'admin' ou 'editor' etc.
CREATE POLICY "Admins full access to costs" ON costs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'super'))
    );
