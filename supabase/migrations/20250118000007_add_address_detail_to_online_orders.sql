-- Add address_detail column to online_orders table
ALTER TABLE public.online_orders
ADD COLUMN IF NOT EXISTS address_detail TEXT;

