-- Fix RLS policies for online_products to work with anonymous users (Kakao browser)

-- Drop all existing policies for online_products
DROP POLICY IF EXISTS "Anyone can view online products" ON public.online_products;
DROP POLICY IF EXISTS "Anyone can update online products quantity" ON public.online_products;
DROP POLICY IF EXISTS "Admins and managers can view online products" ON public.online_products;
DROP POLICY IF EXISTS "Admins and managers can create online products" ON public.online_products;
DROP POLICY IF EXISTS "Admins and managers can update online products" ON public.online_products;
DROP POLICY IF EXISTS "Admins can delete online products" ON public.online_products;

-- Create new policies - Allow all operations for now (can be restricted later)
-- Policy 1: Allow everyone to SELECT (for buy page)
CREATE POLICY "everyone_can_select_online_products" 
ON public.online_products 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy 2: Allow everyone to UPDATE (for buy page orders)
CREATE POLICY "everyone_can_update_online_products" 
ON public.online_products 
FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy 3: Allow everyone to INSERT (for admin page)
CREATE POLICY "everyone_can_insert_online_products" 
ON public.online_products 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Policy 4: Allow everyone to DELETE (for admin page)
CREATE POLICY "everyone_can_delete_online_products" 
ON public.online_products 
FOR DELETE 
TO anon, authenticated
USING (true);

-- Ensure products table also allows anonymous SELECT
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;

CREATE POLICY "everyone_can_select_products" 
ON public.products 
FOR SELECT 
TO anon, authenticated
USING (true);

