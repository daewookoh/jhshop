-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Products can be created by everyone" ON public.products;
DROP POLICY IF EXISTS "Products can be updated by everyone" ON public.products;
DROP POLICY IF EXISTS "Products can be deleted by everyone" ON public.products;
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON public.orders;
DROP POLICY IF EXISTS "Orders can be created by everyone" ON public.orders;

-- Create secure policies requiring authentication
CREATE POLICY "Authenticated users can view all products" 
ON public.products 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create products" 
ON public.products 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products" 
ON public.products 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete products" 
ON public.products 
FOR DELETE 
TO authenticated
USING (true);

-- Secure orders policies - most critical for business data
CREATE POLICY "Authenticated users can view orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete orders" 
ON public.orders 
FOR DELETE 
TO authenticated
USING (true);