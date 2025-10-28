-- Create generic function to generate next number from sequences
CREATE OR REPLACE FUNCTION public.get_next_sequence_number(
  p_company_id UUID,
  p_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
  v_prefix TEXT;
  v_padding INTEGER;
  v_number TEXT;
BEGIN
  -- Get and increment the sequence
  UPDATE sequences
  SET current = current + 1
  WHERE company_id = p_company_id 
    AND code = p_code
  RETURNING current, prefix, padding 
  INTO v_current, v_prefix, v_padding;
  
  -- Format the number with padding
  v_number := v_prefix || LPAD(v_current::TEXT, v_padding, '0');
  
  RETURN v_number;
END;
$$;

-- Create trigger function for invoices
CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get company_id from partner
  SELECT p.company_id INTO v_company_id
  FROM partners p
  WHERE p.id = NEW.partner_id;
  
  -- Generate number if not provided
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := get_next_sequence_number(v_company_id, 'INV');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for stock inventories
CREATE OR REPLACE FUNCTION public.auto_generate_inventory_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate number if not provided
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := get_next_sequence_number(NEW.company_id, 'STK');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add stock sequence to existing companies
INSERT INTO sequences (company_id, code, prefix, padding, current)
SELECT id, 'STK', 'STK-', 4, 0
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM sequences 
  WHERE sequences.company_id = companies.id 
    AND sequences.code = 'STK'
);

-- Update handle_new_user to include STK sequence
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_pipeline_id UUID;
  account_type_val TEXT;
  expires_at_val TIMESTAMPTZ;
BEGIN
  -- Account type & expiration (15 days for demo)
  account_type_val := COALESCE(NEW.raw_user_meta_data->>'account_type', 'demo');
  IF account_type_val = 'demo' THEN
    expires_at_val := NOW() + INTERVAL '15 days';
  ELSE
    expires_at_val := NULL;
  END IF;

  -- 1) Create company
  INSERT INTO companies (name, country, currency, registration_number)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'CD'),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'CDF'),
    COALESCE(NEW.raw_user_meta_data->>'registration_number', '')
  )
  RETURNING id INTO v_company_id;

  -- 2) Create user profile
  INSERT INTO profiles (user_id, full_name, phone, company_id, account_type, expires_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_company_id,
    account_type_val,
    expires_at_val
  );

  -- 3) Assign admin role to first user of company
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::app_role);

  -- 4) Seed defaults
  INSERT INTO taxes (company_id, name, rate) VALUES
    (v_company_id, 'TVA 16%', 16.00),
    (v_company_id, 'TVA 0%', 0.00);

  INSERT INTO uom (company_id, name, code) VALUES
    (v_company_id, 'Pièce', 'PCS'),
    (v_company_id, 'Kg', 'KG'),
    (v_company_id, 'Litre', 'L');

  INSERT INTO product_categories (company_id, name) VALUES
    (v_company_id, 'Produits'),
    (v_company_id, 'Services');

  INSERT INTO crm_pipelines (company_id, name)
  VALUES (v_company_id, 'Ventes')
  RETURNING id INTO v_pipeline_id;

  INSERT INTO crm_stages (company_id, pipeline_id, name, order_seq, won_flag) VALUES
    (v_company_id, v_pipeline_id, 'Nouveau', 1, false),
    (v_company_id, v_pipeline_id, 'Qualifié', 2, false),
    (v_company_id, v_pipeline_id, 'Proposition', 3, false),
    (v_company_id, v_pipeline_id, 'Gagné', 4, true);

  INSERT INTO stock_locations (company_id, name, type) VALUES
    (v_company_id, 'Stock Principal', 'internal'),
    (v_company_id, 'Fournisseurs', 'supplier'),
    (v_company_id, 'Clients', 'customer');

  INSERT INTO sequences (company_id, code, prefix, padding, current) VALUES
    (v_company_id, 'INV', 'FA-', 4, 0),
    (v_company_id, 'SO',  'CMD-', 4, 0),
    (v_company_id, 'PRO', 'PRO-', 4, 0),
    (v_company_id, 'STK', 'STK-', 4, 0);

  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_auto_generate_invoice_number ON invoices;
CREATE TRIGGER trigger_auto_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice_number();

DROP TRIGGER IF EXISTS trigger_auto_generate_inventory_number ON stock_inventories;
CREATE TRIGGER trigger_auto_generate_inventory_number
  BEFORE INSERT ON stock_inventories
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_inventory_number();