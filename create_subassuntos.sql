-- Criação da tabela subassuntos
CREATE TABLE IF NOT EXISTS public.subassuntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    assunto_id UUID NOT NULL REFERENCES public.assuntos(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configuração de RLS
ALTER TABLE public.subassuntos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Enable read access for all users on subassuntos"
ON public.subassuntos FOR SELECT USING (true);

CREATE POLICY "Enable full access for admin users on subassuntos"
ON public.subassuntos FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Criação de índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_subassuntos_assunto_id ON public.subassuntos(assunto_id);
-- Atualização no schema cache
NOTIFY pgrst, 'reload schema';
