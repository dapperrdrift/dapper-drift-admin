-- Add slug column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create an index to make finding products by slug fast
CREATE INDEX IF NOT EXISTS products_slug_idx ON public.products (slug);
