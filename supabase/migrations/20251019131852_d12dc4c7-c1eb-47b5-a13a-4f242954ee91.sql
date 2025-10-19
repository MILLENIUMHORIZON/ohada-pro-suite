-- Add company_id to configuration tables
ALTER TABLE taxes ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE uom ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE product_categories ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE crm_pipelines ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE crm_stages ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE stock_locations ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE sequences ADD COLUMN company_id UUID REFERENCES companies(id);

-- Add company_id to stock operations
ALTER TABLE stock_moves ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE stock_quants ADD COLUMN company_id UUID REFERENCES companies(id);

-- Backfill existing data with first company (or delete if no companies exist)
UPDATE taxes SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE uom SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE product_categories SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE crm_pipelines SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE crm_stages SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE stock_locations SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE sequences SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE stock_moves SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
UPDATE stock_quants SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;

-- Make company_id NOT NULL after backfill
ALTER TABLE taxes ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE uom ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE product_categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE crm_pipelines ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE crm_stages ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE stock_locations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sequences ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE stock_moves ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE stock_quants ALTER COLUMN company_id SET NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_taxes_company ON taxes(company_id);
CREATE INDEX idx_uom_company ON uom(company_id);
CREATE INDEX idx_product_categories_company ON product_categories(company_id);
CREATE INDEX idx_crm_pipelines_company ON crm_pipelines(company_id);
CREATE INDEX idx_crm_stages_company ON crm_stages(company_id);
CREATE INDEX idx_stock_locations_company ON stock_locations(company_id);
CREATE INDEX idx_sequences_company ON sequences(company_id);
CREATE INDEX idx_stock_moves_company ON stock_moves(company_id);
CREATE INDEX idx_stock_quants_company ON stock_quants(company_id);

-- Add unique constraint for sequences to prevent collisions
ALTER TABLE sequences DROP CONSTRAINT IF EXISTS sequences_code_key;
ALTER TABLE sequences ADD CONSTRAINT sequences_company_code_unique UNIQUE (company_id, code);

-- Update RLS policies for taxes
DROP POLICY IF EXISTS "Authenticated users can view taxes" ON taxes;
DROP POLICY IF EXISTS "Authenticated users can update taxes" ON taxes;
DROP POLICY IF EXISTS "Authenticated users can insert taxes" ON taxes;
DROP POLICY IF EXISTS "Authenticated users can delete taxes" ON taxes;

CREATE POLICY "Users view own company taxes"
ON taxes FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company taxes"
ON taxes FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for uom
DROP POLICY IF EXISTS "Authenticated users can view uom" ON uom;
DROP POLICY IF EXISTS "Authenticated users can update uom" ON uom;
DROP POLICY IF EXISTS "Authenticated users can insert uom" ON uom;
DROP POLICY IF EXISTS "Authenticated users can delete uom" ON uom;

CREATE POLICY "Users view own company uom"
ON uom FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company uom"
ON uom FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for product_categories
DROP POLICY IF EXISTS "Authenticated users can view product_categories" ON product_categories;
DROP POLICY IF EXISTS "Authenticated users can update product_categories" ON product_categories;
DROP POLICY IF EXISTS "Authenticated users can insert product_categories" ON product_categories;
DROP POLICY IF EXISTS "Authenticated users can delete product_categories" ON product_categories;

CREATE POLICY "Users view own company product_categories"
ON product_categories FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company product_categories"
ON product_categories FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for crm_pipelines
DROP POLICY IF EXISTS "Authenticated users can view crm_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "Authenticated users can update crm_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "Authenticated users can insert crm_pipelines" ON crm_pipelines;
DROP POLICY IF EXISTS "Authenticated users can delete crm_pipelines" ON crm_pipelines;

CREATE POLICY "Users view own company crm_pipelines"
ON crm_pipelines FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company crm_pipelines"
ON crm_pipelines FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for crm_stages
DROP POLICY IF EXISTS "Authenticated users can view crm_stages" ON crm_stages;
DROP POLICY IF EXISTS "Authenticated users can update crm_stages" ON crm_stages;
DROP POLICY IF EXISTS "Authenticated users can insert crm_stages" ON crm_stages;
DROP POLICY IF EXISTS "Authenticated users can delete crm_stages" ON crm_stages;

CREATE POLICY "Users view own company crm_stages"
ON crm_stages FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company crm_stages"
ON crm_stages FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for stock_locations
DROP POLICY IF EXISTS "Authenticated users can view stock_locations" ON stock_locations;
DROP POLICY IF EXISTS "Authenticated users can update stock_locations" ON stock_locations;
DROP POLICY IF EXISTS "Authenticated users can insert stock_locations" ON stock_locations;
DROP POLICY IF EXISTS "Authenticated users can delete stock_locations" ON stock_locations;

CREATE POLICY "Users view own company stock_locations"
ON stock_locations FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company stock_locations"
ON stock_locations FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for sequences
DROP POLICY IF EXISTS "Authenticated users can view sequences" ON sequences;
DROP POLICY IF EXISTS "Authenticated users can update sequences" ON sequences;
DROP POLICY IF EXISTS "Authenticated users can insert sequences" ON sequences;
DROP POLICY IF EXISTS "Authenticated users can delete sequences" ON sequences;

CREATE POLICY "Users view own company sequences"
ON sequences FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company sequences"
ON sequences FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for stock_moves
DROP POLICY IF EXISTS "Authenticated users can view stock_moves" ON stock_moves;
DROP POLICY IF EXISTS "Authenticated users can update stock_moves" ON stock_moves;
DROP POLICY IF EXISTS "Authenticated users can insert stock_moves" ON stock_moves;
DROP POLICY IF EXISTS "Authenticated users can delete stock_moves" ON stock_moves;

CREATE POLICY "Users view own company stock_moves"
ON stock_moves FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company stock_moves"
ON stock_moves FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update RLS policies for stock_quants
DROP POLICY IF EXISTS "Authenticated users can view stock_quants" ON stock_quants;
DROP POLICY IF EXISTS "Authenticated users can update stock_quants" ON stock_quants;
DROP POLICY IF EXISTS "Authenticated users can insert stock_quants" ON stock_quants;
DROP POLICY IF EXISTS "Authenticated users can delete stock_quants" ON stock_quants;

CREATE POLICY "Users view own company stock_quants"
ON stock_quants FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users manage own company stock_quants"
ON stock_quants FOR ALL TO authenticated
USING (company_id = get_user_company_id());

-- Update handle_new_user trigger to seed default configuration data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  account_type_val TEXT;
  expires_at_val TIMESTAMPTZ;
BEGIN
  -- Extract account type and expiration
  account_type_val := COALESCE(NEW.raw_user_meta_data->>'account_type', 'user');
  
  -- Set expiration for demo accounts (15 days)
  IF account_type_val = 'demo' THEN
    expires_at_val := NOW() + INTERVAL '15 days';
  ELSE
    expires_at_val := NULL;
  END IF;

  -- Create company
  INSERT INTO companies (name, country, currency, registration_number)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'CD'),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'CDF'),
    COALESCE(NEW.raw_user_meta_data->>'registration_number', '')
  )
  RETURNING id INTO new_company_id;

  -- Create user profile
  INSERT INTO profiles (user_id, full_name, phone, company_id, account_type, expires_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    new_company_id,
    account_type_val,
    expires_at_val
  );

  -- Assign default role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, account_type_val::app_role);

  -- Seed default taxes
  INSERT INTO taxes (company_id, name, rate, type) VALUES
    (new_company_id, 'TVA 16%', 16.00, 'sale'),
    (new_company_id, 'TVA 0%', 0.00, 'sale');

  -- Seed default units of measure
  INSERT INTO uom (company_id, name, category) VALUES
    (new_company_id, 'Pièce', 'unit'),
    (new_company_id, 'Kg', 'weight'),
    (new_company_id, 'Litre', 'volume');

  -- Seed default product categories
  INSERT INTO product_categories (company_id, name) VALUES
    (new_company_id, 'Produits'),
    (new_company_id, 'Services');

  -- Seed default CRM pipeline and stages
  INSERT INTO crm_pipelines (company_id, name, is_default) VALUES
    (new_company_id, 'Ventes', true)
  RETURNING id INTO new_company_id; -- Reuse variable for pipeline_id

  INSERT INTO crm_stages (company_id, pipeline_id, name, sequence, probability) VALUES
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), new_company_id, 'Nouveau', 1, 10),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), new_company_id, 'Qualifié', 2, 30),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), new_company_id, 'Proposition', 3, 60),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), new_company_id, 'Gagné', 4, 100);

  -- Seed default stock locations
  INSERT INTO stock_locations (company_id, name, location_type) VALUES
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), 'Stock Principal', 'internal'),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), 'Fournisseurs', 'supplier'),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), 'Clients', 'customer');

  -- Seed default sequences
  INSERT INTO sequences (company_id, name, code, prefix, padding, next_number) VALUES
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), 'Factures', 'INV', 'FA-', 4, 1),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), 'Commandes', 'SO', 'CMD-', 4, 1),
    ((SELECT company_id FROM profiles WHERE user_id = NEW.id), 'Proformas', 'PRO', 'PRO-', 4, 1);

  RETURN NEW;
END;
$$;