BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Private bucket: invoices contain customer PII (address, order contents).
-- Admins access files via signed URLs generated on demand from the admin panel.
CREATE POLICY "Admins can manage invoices"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'invoices' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'invoices' AND public.has_role(auth.uid(), 'admin'));

COMMIT;
