-- ============================================================
-- Fix: Add payment_pending to order_status enum (if missing)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.order_status'::regtype
    AND enumlabel = 'payment_pending'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'payment_pending' BEFORE 'placed';
  END IF;
END
$$;

-- ============================================================
-- Fix: Add missing columns to orders table
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL;

-- ============================================================
-- Fix: Add Razorpay-specific columns to payments table
-- ============================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- ============================================================
-- Fix: RLS policies so authenticated users can read their own orders
-- ============================================================

-- Users can SELECT their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can SELECT order items belonging to their orders
CREATE POLICY "Users can view own order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- Users can SELECT payments belonging to their orders
CREATE POLICY "Users can view own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );
