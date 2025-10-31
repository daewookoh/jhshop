-- Change online_products.id from UUID to SERIAL (INT AUTO_INCREMENT)
-- This migration is for existing tables that were created with UUID

-- Step 1: Drop existing constraints that might reference the id column
DROP INDEX IF EXISTS idx_online_products_product_id;
DROP TRIGGER IF EXISTS update_online_products_updated_at ON public.online_products;

-- Step 2: Create a new table with SERIAL id
CREATE TABLE IF NOT EXISTS public.online_products_new (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 3: Copy data from old table to new table (if exists)
-- Note: This will lose the UUID id and create new sequential ids
INSERT INTO public.online_products_new (
  product_id,
  start_datetime,
  end_datetime,
  available_quantity,
  created_at,
  updated_at
)
SELECT 
  product_id,
  start_datetime,
  end_datetime,
  available_quantity,
  created_at,
  updated_at
FROM public.online_products;

-- Step 4: Drop old table
DROP TABLE IF EXISTS public.online_products;

-- Step 5: Rename new table to original name
ALTER TABLE public.online_products_new RENAME TO online_products;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_online_products_product_id ON public.online_products(product_id);
CREATE INDEX IF NOT EXISTS idx_online_products_start_datetime ON public.online_products(start_datetime);
CREATE INDEX IF NOT EXISTS idx_online_products_end_datetime ON public.online_products(end_datetime);

-- Step 7: Recreate trigger
CREATE TRIGGER update_online_products_updated_at
BEFORE UPDATE ON public.online_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 8: Recreate RLS policies
ALTER TABLE public.online_products ENABLE ROW LEVEL SECURITY;

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

