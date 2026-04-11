-- Add Shiprocket order reference to orders table
-- Used to track which Shiprocket order corresponds to each of our orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shiprocket_order_id TEXT;
