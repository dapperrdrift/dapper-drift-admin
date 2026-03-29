
-- Create hero-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('hero-images', 'hero-images', true);

-- Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Allow authenticated admins to upload to hero-images
CREATE POLICY "Admins can upload hero images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated admins to update hero-images
CREATE POLICY "Admins can update hero images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated admins to delete hero-images
CREATE POLICY "Admins can delete hero images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow public read access to hero-images
CREATE POLICY "Public can read hero images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'hero-images');

-- Allow authenticated admins to upload to product-images
CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated admins to update product-images
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated admins to delete product-images
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin')
);

-- Allow public read access to product-images
CREATE POLICY "Public can read product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images');
