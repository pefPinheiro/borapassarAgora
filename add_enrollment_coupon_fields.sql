-- Adiciona a coluna coupon_applied na tabela enrollments para registrar o cupom usado
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS coupon_applied TEXT;

-- Adiciona também uma coluna amount_discount se desejar registrar o valor exato do desconto
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS amount_discount DECIMAL(10,2) DEFAULT 0;
