-- 1. Add currency column to accounts table for treasury accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT NULL;

-- 2. Create exchange_rates table for storing daily rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18, 6) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, from_currency, to_currency, effective_date)
);

-- 3. Create user_treasury_accounts junction table for user authorization
CREATE TABLE IF NOT EXISTS public.user_treasury_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, account_id)
);

-- 4. Add currency and exchange_rate columns to account_moves
ALTER TABLE public.account_moves ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CDF';
ALTER TABLE public.account_moves ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) DEFAULT 1;

-- 5. Add currency and exchange_rate columns to account_move_lines
ALTER TABLE public.account_move_lines ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) DEFAULT 1;

-- 6. Create currency_conversions table for tracking explicit conversions
CREATE TABLE IF NOT EXISTS public.currency_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  from_amount NUMERIC(18, 2) NOT NULL,
  to_amount NUMERIC(18, 2) NOT NULL,
  exchange_rate NUMERIC(18, 6) NOT NULL,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID NOT NULL REFERENCES public.accounts(id),
  account_move_id UUID REFERENCES public.account_moves(id),
  exchange_gain_loss NUMERIC(18, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 7. Enable RLS on new tables
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_treasury_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_conversions ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies for exchange_rates
CREATE POLICY "Users can view exchange rates for their company"
ON public.exchange_rates FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert exchange rates for their company"
ON public.exchange_rates FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update exchange rates for their company"
ON public.exchange_rates FOR UPDATE
USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete exchange rates for their company"
ON public.exchange_rates FOR DELETE
USING (company_id = get_user_company_id());

-- 9. RLS policies for user_treasury_accounts
CREATE POLICY "Users can view treasury account assignments for their company"
ON public.user_treasury_accounts FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage treasury account assignments"
ON public.user_treasury_accounts FOR ALL
USING (company_id = get_user_company_id());

-- 10. RLS policies for currency_conversions
CREATE POLICY "Users can view currency conversions for their company"
ON public.currency_conversions FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert currency conversions for their company"
ON public.currency_conversions FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- 11. Function to get latest exchange rate
CREATE OR REPLACE FUNCTION public.get_latest_exchange_rate(
  p_company_id UUID,
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3)
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- If same currency, return 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1;
  END IF;

  -- Get the latest rate
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE company_id = p_company_id
    AND from_currency = p_from_currency
    AND to_currency = p_to_currency
  ORDER BY effective_date DESC
  LIMIT 1;

  -- If no direct rate, try inverse
  IF v_rate IS NULL THEN
    SELECT 1 / rate INTO v_rate
    FROM exchange_rates
    WHERE company_id = p_company_id
      AND from_currency = p_to_currency
      AND to_currency = p_from_currency
    ORDER BY effective_date DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_rate, 1);
END;
$$;

-- 12. Function to check if user can access treasury account
CREATE OR REPLACE FUNCTION public.can_access_treasury_account(
  p_user_id UUID,
  p_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_has_access BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  -- Check if user has explicit access
  SELECT EXISTS (
    SELECT 1 FROM user_treasury_accounts 
    WHERE user_id = p_user_id AND account_id = p_account_id
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;

-- 13. Function to get account balance by currency
CREATE OR REPLACE FUNCTION public.get_account_balance_by_currency(
  p_account_id UUID,
  p_currency VARCHAR(3) DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance NUMERIC := 0;
BEGIN
  IF p_currency IS NULL THEN
    -- Return balance in account's currency
    SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
    INTO v_balance
    FROM account_move_lines aml
    JOIN account_moves am ON am.id = aml.move_id
    WHERE aml.account_id = p_account_id
      AND am.state = 'posted';
  ELSE
    -- Return balance filtered by currency
    SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
    INTO v_balance
    FROM account_move_lines aml
    JOIN account_moves am ON am.id = aml.move_id
    WHERE aml.account_id = p_account_id
      AND am.state = 'posted'
      AND am.currency = p_currency;
  END IF;
  
  RETURN v_balance;
END;
$$;