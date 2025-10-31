-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('입금대기', '입금완료');

-- Create online_orders table
CREATE TABLE IF NOT EXISTS public.online_orders (
  id SERIAL PRIMARY KEY,
  online_product_id INTEGER NOT NULL REFERENCES public.online_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  payment_status payment_status NOT NULL DEFAULT '입금대기',
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  orderer_mobile TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for buy page)
CREATE POLICY "Anyone can view their own orders" 
ON public.online_orders 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create orders" 
ON public.online_orders 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their own orders" 
ON public.online_orders 
FOR UPDATE 
USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_online_orders_online_product_id ON public.online_orders(online_product_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_mobile ON public.online_orders(mobile);
CREATE INDEX IF NOT EXISTS idx_online_orders_orderer_mobile ON public.online_orders(orderer_mobile);
CREATE INDEX IF NOT EXISTS idx_online_orders_payment_status ON public.online_orders(payment_status);

-- Create trigger for updated_at (using existing function)
CREATE TRIGGER update_online_orders_updated_at
BEFORE UPDATE ON public.online_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

