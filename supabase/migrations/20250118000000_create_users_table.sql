-- Create users table for buy page login
CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  mobile TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (anyone can read/write for buy page)
CREATE POLICY "Anyone can view users" 
ON public.users 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert users" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update users" 
ON public.users 
FOR UPDATE 
USING (true);

-- Create index on mobile for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users(mobile);

-- Create trigger for updated_at (using existing function)
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

