-- Create online_products table
CREATE TABLE IF NOT EXISTS public.online_products (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.online_products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and managers can view online products" 
ON public.online_products 
FOR SELECT 
USING (public.has_role('manager') OR public.has_role('admin'));

CREATE POLICY "Admins and managers can create online products" 
ON public.online_products 
FOR INSERT 
WITH CHECK (public.has_role('manager') OR public.has_role('admin'));

CREATE POLICY "Admins and managers can update online products" 
ON public.online_products 
FOR UPDATE 
USING (public.has_role('manager') OR public.has_role('admin'));

CREATE POLICY "Admins can delete online products" 
ON public.online_products 
FOR DELETE 
USING (public.has_role('admin'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_online_products_product_id ON public.online_products(product_id);
CREATE INDEX IF NOT EXISTS idx_online_products_start_datetime ON public.online_products(start_datetime);
CREATE INDEX IF NOT EXISTS idx_online_products_end_datetime ON public.online_products(end_datetime);

-- Create trigger for updated_at (using existing function)
CREATE TRIGGER update_online_products_updated_at
BEFORE UPDATE ON public.online_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

