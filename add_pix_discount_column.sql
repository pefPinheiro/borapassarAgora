ALTER TABLE courses
ADD COLUMN IF NOT EXISTS pix_discount numeric DEFAULT 0;
