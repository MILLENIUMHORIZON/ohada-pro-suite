-- Recréer le trigger handle_new_user pour corriger le bug
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_pipeline_id UUID;
  account_type_val TEXT;
  expires_at_val TIMESTAMPTZ;
  v_metadata_company_id TEXT;
BEGIN
  -- Get company_id from metadata (it's stored as text in jsonb)
  v_metadata_company_id := NEW.raw_user_meta_data->>'company_id';
  
  -- Check if user is being added to an existing company (via admin)
  IF v_metadata_company_id IS NOT NULL AND v_metadata_company_id != '' THEN
    -- User is being added to existing company, don't create new company or seed data
    v_company_id := v_metadata_company_id::UUID;
    account_type_val := COALESCE(NEW.raw_user_meta_data->>'account_type', 'user');
    expires_at_val := NULL;
    
    -- Create user profile only
    INSERT INTO profiles (user_id, full_name, phone, company_id, account_type, expires_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      v_company_id,
      account_type_val,
      expires_at_val
    );
    
    RETURN NEW;
  END IF;

  -- New signup - create company and seed data
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

  -- 2) Update user metadata with company_id for session access
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('company_id', v_company_id::text)
  WHERE id = NEW.id;

  -- 3) Create user profile
  INSERT INTO profiles (user_id, full_name, phone, company_id, account_type, expires_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_company_id,
    account_type_val,
    expires_at_val
  );

  -- 4) Assign admin role to first user of company (default for demo accounts)
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::app_role);

  -- 5) Seed defaults
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

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();