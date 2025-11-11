-- Add '주문취소' to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS '주문취소';

