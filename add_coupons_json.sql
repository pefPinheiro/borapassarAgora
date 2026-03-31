-- Adiciona a coluna coupons_json na tabela courses para suportar múltiplos cupons per curso
ALTER TABLE courses ADD COLUMN IF NOT EXISTS coupons_json JSONB DEFAULT '[]'::jsonb;

-- Comentário: A coluna coupon_name antiga pode ser mantida para compatibilidade, 
-- mas a nova interface de múltiplos cupons usará esta coluna JSONB.
