-- Criação da tabela subsubassuntos
CREATE TABLE IF NOT EXISTS public.subsubassuntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subassunto_id UUID NOT NULL REFERENCES public.subassuntos(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configuração de RLS
ALTER TABLE public.subsubassuntos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Enable read access for all users on subsubassuntos"
ON public.subsubassuntos FOR SELECT USING (true);

CREATE POLICY "Enable full access for admin users on subsubassuntos"
ON public.subsubassuntos FOR ALL USING (public.is_admin());

-- Criação de índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_subsubassuntos_subassunto_id ON public.subsubassuntos(subassunto_id);
-- Atualização no schema cache
NOTIFY pgrst, 'reload schema';
