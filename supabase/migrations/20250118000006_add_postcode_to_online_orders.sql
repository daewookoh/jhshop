-- Add postcode column to online_orders table
ALTER TABLE public.online_orders
ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_online_orders_postcode ON public.online_orders(postcode);

