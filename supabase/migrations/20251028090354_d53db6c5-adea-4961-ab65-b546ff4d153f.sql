-- Fix handle_new_user to match current schema and data model
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 1) Create company (columns must exist in public.companies)
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

  -- 3) Assign default role (demo -> user)
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(account_type_val, ''), 'user')::app_role);

  -- 4) Seed defaults matching current schema
  -- Taxes (no 'type' column in current schema)
  INSERT INTO taxes (company_id, name, rate) VALUES
    (v_company_id, 'TVA 16%', 16.00),
    (v_company_id, 'TVA 0%', 0.00);

  -- Units of Measure (uom has code + name)
  INSERT INTO uom (company_id, name, code) VALUES
    (v_company_id, 'Pièce', 'PCS'),
    (v_company_id, 'Kg', 'KG'),
    (v_company_id, 'Litre', 'L');

  -- Product Categories
  INSERT INTO product_categories (company_id, name) VALUES
    (v_company_id, 'Produits'),
    (v_company_id, 'Services');

  -- CRM Pipeline (crm_pipelines has no is_default)
  INSERT INTO crm_pipelines (company_id, name)
  VALUES (v_company_id, 'Ventes')
  RETURNING id INTO v_pipeline_id;

  -- CRM Stages (crm_stages uses order_seq + won_flag)
  INSERT INTO crm_stages (company_id, pipeline_id, name, order_seq, won_flag) VALUES
    (v_company_id, v_pipeline_id, 'Nouveau', 1, false),
    (v_company_id, v_pipeline_id, 'Qualifié', 2, false),
    (v_company_id, v_pipeline_id, 'Proposition', 3, false),
    (v_company_id, v_pipeline_id, 'Gagné', 4, true);

  -- Stock Locations (stock_locations uses column "type")
  INSERT INTO stock_locations (company_id, name, type) VALUES
    (v_company_id, 'Stock Principal', 'internal'),
    (v_company_id, 'Fournisseurs', 'supplier'),
    (v_company_id, 'Clients', 'customer');

  -- Sequences (no name, uses current)
  INSERT INTO sequences (company_id, code, prefix, padding, current) VALUES
    (v_company_id, 'INV', 'FA-', 4, 0),
    (v_company_id, 'SO',  'CMD-', 4, 0),
    (v_company_id, 'PRO', 'PRO-', 4, 0);

  RETURN NEW;
END;
$$;

-- Recreate trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();