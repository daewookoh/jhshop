-- Add '발송완료' to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS '발송완료';

