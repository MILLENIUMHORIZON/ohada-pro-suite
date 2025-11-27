-- Drop the old trigger function
DROP FUNCTION IF EXISTS public.auto_assign_customer_account() CASCADE;

-- Create updated function that handles all partner types correctly
CREATE OR REPLACE FUNCTION public.auto_assign_customer_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_last_account_code TEXT;
  v_next_account_code TEXT;
  v_account_number INTEGER;
BEGIN
  -- Only process if no account_id is set
  IF NEW.account_id IS NULL THEN
    
    -- Find the last customer account code (accounts starting with '411')
    SELECT code INTO v_last_account_code
    FROM accounts
    WHERE company_id = NEW.company_id
      AND code LIKE '411%'
      AND type = 'asset'
    ORDER BY code DESC
    LIMIT 1;
    
    -- If no account exists, start with 4110001
    IF v_last_account_code IS NULL THEN
      v_next_account_code := '4110001';
    ELSE
      -- Extract the numeric part and increment
      v_account_number := SUBSTRING(v_last_account_code FROM 4)::INTEGER + 1;
      v_next_account_code := '411' || LPAD(v_account_number::TEXT, 4, '0');
    END IF;
    
    -- Create the new account
    INSERT INTO accounts (company_id, code, name, type, reconcilable)
    VALUES (
      NEW.company_id,
      v_next_account_code,
      'Client - ' || NEW.name,
      'asset',
      true
    )
    RETURNING id INTO v_account_id;
    
    -- Assign the account to the partner
    NEW.account_id := v_account_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS auto_assign_customer_account_trigger ON partners;
CREATE TRIGGER auto_assign_customer_account_trigger
  BEFORE INSERT ON partners
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_customer_account();