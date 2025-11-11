-- Add '예약취소' to payment_status enum
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS '예약취소';

