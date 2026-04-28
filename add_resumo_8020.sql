
ALTER TABLE apostilas ADD COLUMN IF NOT EXISTS is_resumo_8020 boolean DEFAULT false;

-- Policy adjustment if needed (usually apostilas policies already cover this)
