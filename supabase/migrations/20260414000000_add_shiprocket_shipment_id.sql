ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shiprocket_shipment_id TEXT;
