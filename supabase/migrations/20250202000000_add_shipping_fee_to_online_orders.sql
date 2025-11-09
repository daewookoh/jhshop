-- Add shipping_fee column to online_orders table
ALTER TABLE public.online_orders
ADD COLUMN IF NOT EXISTS shipping_fee INTEGER NOT NULL DEFAULT 4000;

-- Create index for faster lookups (optional, but useful if we query by shipping_fee)
CREATE INDEX IF NOT EXISTS idx_online_orders_shipping_fee ON public.online_orders(shipping_fee);

