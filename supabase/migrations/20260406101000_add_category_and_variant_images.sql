BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.variants
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload category images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update category images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete category images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Public can read category images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'category-images');

COMMIT;
