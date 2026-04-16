-- Adiciona o campo is_resolution_notebook na tabela apostilas
ALTER TABLE apostilas
ADD COLUMN IF NOT EXISTS is_resolution_notebook BOOLEAN DEFAULT false;
