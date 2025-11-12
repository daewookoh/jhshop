-- Add shipping_fee column to online_products table
ALTER TABLE public.online_products
ADD COLUMN IF NOT EXISTS shipping_fee INTEGER NOT NULL DEFAULT 4000;

-- Create index for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_online_products_shipping_fee ON public.online_products(shipping_fee);

