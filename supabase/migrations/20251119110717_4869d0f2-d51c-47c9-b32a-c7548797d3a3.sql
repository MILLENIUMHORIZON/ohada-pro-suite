-- Create payment_attempts table to track payment attempts
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  key_type TEXT NOT NULL,
  number_of_users INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  duration_type TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  phone TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment attempts
CREATE POLICY "Users can view own payment attempts"
ON public.payment_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own payment attempts
CREATE POLICY "Users can insert own payment attempts"
ON public.payment_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all payment attempts
CREATE POLICY "Admins can view all payment attempts"
ON public.payment_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON public.payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_uuid ON public.payment_attempts(uuid);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(payment_status);