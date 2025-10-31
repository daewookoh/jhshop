-- Allow public select for online_products (for buy page)
CREATE POLICY "Anyone can view online products" 
ON public.online_products 
FOR SELECT 
USING (true);

-- Allow public update for online_products available_quantity (for buy page orders)
CREATE POLICY "Anyone can update online products quantity" 
ON public.online_products 
FOR UPDATE 
USING (true)
WITH CHECK (true);

