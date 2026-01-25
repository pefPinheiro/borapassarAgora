-- Inserir dados de exemplo na tabela costs (apenas se a tabela estiver vazia ou para teste)

INSERT INTO costs (description, amount, category, payment_date, recurrence, status, notes)
VALUES
('Hospedagem Supabase', 125.00, 'Recurso', '2026-01-15', 'Mensal', 'Pendente', 'Plano Pro'),
('Contabilidade Trimestral', 850.00, 'Serviço', '2026-01-10', 'Único', 'Pago', 'Referente ao Q4 2025'),
('Anúncios Meta Ads', 2500.00, 'Marketing', '2026-01-20', 'Mensal', 'Pendente', 'Campanha de Verão'),
('Licença Adobe Creative Cloud', 240.00, 'Recurso', '2026-01-05', 'Mensal', 'Pago', 'Design Team'),
('Limpeza do Escritório', 400.00, 'Serviço', '2026-01-12', 'Mensal', 'Pago', NULL),
('Compra de Novos Monitores', 3200.00, 'Aquisição', '2026-01-08', 'Único', 'Pago', '3 Monitores Dell para equipe de dev'),
('Café e Insumos Copa', 150.50, 'Outros', '2026-01-02', 'Mensal', 'Pago', NULL),
('Freelancer Design (Logo)', 600.00, 'Serviço', '2026-01-18', 'Único', 'Pendente', 'Redesign da marca secundária');
