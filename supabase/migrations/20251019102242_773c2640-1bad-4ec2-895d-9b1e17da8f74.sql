-- ERP v1: Core Tables for CRM, Sales, Stock, and Accounting

-- ====================================
-- COMMON / REFERENTIALS
-- ====================================

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rccm TEXT,
  id_nat TEXT,
  nif TEXT,
  currency TEXT DEFAULT 'CDF',
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partners (Customers & Vendors)
CREATE TYPE partner_type AS ENUM ('customer', 'vendor', 'both');

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type partner_type NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nif TEXT,
  address TEXT,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Categories
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES product_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units of Measure
CREATE TABLE uom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  ratio NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default UoM
INSERT INTO uom (name, code, ratio) VALUES 
  ('Unité', 'unit', 1.0),
  ('Kilogramme', 'kg', 1.0),
  ('Litre', 'l', 1.0),
  ('Mètre', 'm', 1.0),
  ('Boîte', 'box', 1.0);

-- Tax Configuration
CREATE TABLE taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 0,
  account_collected_id UUID,
  account_deductible_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default TVA
INSERT INTO taxes (name, rate) VALUES 
  ('TVA 16%', 16.0),
  ('Exonéré', 0.0);

-- Product Types
CREATE TYPE product_type AS ENUM ('stock', 'service');
CREATE TYPE cost_method AS ENUM ('fifo', 'average');

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type product_type NOT NULL DEFAULT 'stock',
  description TEXT,
  uom_id UUID REFERENCES uom(id),
  category_id UUID REFERENCES product_categories(id),
  cost_method cost_method DEFAULT 'fifo',
  unit_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  tax_id UUID REFERENCES taxes(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- CRM MODULE
-- ====================================

-- CRM Pipelines
CREATE TABLE crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Stages
CREATE TABLE crm_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_seq INTEGER NOT NULL DEFAULT 0,
  won_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pipeline and stages
INSERT INTO crm_pipelines (name, description) VALUES 
  ('Pipeline Ventes', 'Pipeline principal pour les opportunités de vente');

INSERT INTO crm_stages (pipeline_id, name, order_seq, won_flag) 
SELECT id, 'Nouveau', 1, false FROM crm_pipelines WHERE name = 'Pipeline Ventes'
UNION ALL
SELECT id, 'Qualification', 2, false FROM crm_pipelines WHERE name = 'Pipeline Ventes'
UNION ALL
SELECT id, 'Proposition', 3, false FROM crm_pipelines WHERE name = 'Pipeline Ventes'
UNION ALL
SELECT id, 'Négociation', 4, false FROM crm_pipelines WHERE name = 'Pipeline Ventes'
UNION ALL
SELECT id, 'Gagné', 5, true FROM crm_pipelines WHERE name = 'Pipeline Ventes';

-- CRM Leads
CREATE TABLE crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id),
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  stage_id UUID REFERENCES crm_stages(id),
  owner_id UUID REFERENCES auth.users(id),
  expected_revenue NUMERIC DEFAULT 0,
  probability INTEGER DEFAULT 0,
  close_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- SALES / INVOICING MODULE
-- ====================================

-- Sale Orders Status
CREATE TYPE sale_status AS ENUM ('draft', 'confirmed', 'done', 'cancelled');

-- Sale Orders
CREATE TABLE sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  partner_id UUID REFERENCES partners(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status sale_status DEFAULT 'draft',
  currency TEXT DEFAULT 'CDF',
  notes TEXT,
  total_ht NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Order Lines
CREATE TABLE sale_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES sale_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  uom_id UUID REFERENCES uom(id),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  tax_id UUID REFERENCES taxes(id),
  subtotal NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Types
CREATE TYPE invoice_type AS ENUM ('customer', 'vendor', 'credit_note');
CREATE TYPE invoice_status AS ENUM ('draft', 'posted', 'paid', 'cancelled');

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  type invoice_type NOT NULL DEFAULT 'customer',
  partner_id UUID REFERENCES partners(id) NOT NULL,
  order_id UUID REFERENCES sale_orders(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status invoice_status DEFAULT 'draft',
  currency TEXT DEFAULT 'CDF',
  notes TEXT,
  total_ht NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Lines
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) NOT NULL,
  description TEXT,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_id UUID REFERENCES taxes(id),
  subtotal NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TYPE payment_status AS ENUM ('draft', 'posted', 'cancelled');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  partner_id UUID REFERENCES partners(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'CDF',
  status payment_status DEFAULT 'draft',
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- STOCK MODULE
-- ====================================

-- Location Types
CREATE TYPE location_type AS ENUM ('internal', 'supplier', 'customer', 'transit', 'scrap');

-- Stock Locations
CREATE TABLE stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type location_type NOT NULL DEFAULT 'internal',
  parent_id UUID REFERENCES stock_locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default locations
INSERT INTO stock_locations (name, type) VALUES 
  ('Stock Principal', 'internal'),
  ('Fournisseurs', 'supplier'),
  ('Clients', 'customer'),
  ('Transit', 'transit'),
  ('Rebut', 'scrap');

-- Stock Move Status
CREATE TYPE stock_move_status AS ENUM ('draft', 'confirmed', 'done', 'cancelled');

-- Stock Moves
CREATE TABLE stock_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  uom_id UUID REFERENCES uom(id),
  from_location_id UUID REFERENCES stock_locations(id) NOT NULL,
  to_location_id UUID REFERENCES stock_locations(id) NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  state stock_move_status DEFAULT 'draft',
  cost NUMERIC DEFAULT 0,
  origin TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Quants (Inventory Levels)
CREATE TABLE stock_quants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  location_id UUID REFERENCES stock_locations(id) NOT NULL,
  qty_on_hand NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id)
);

-- ====================================
-- ACCOUNTING MODULE (OHADA Base)
-- ====================================

-- Account Types
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

-- Chart of Accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  parent_id UUID REFERENCES accounts(id),
  reconcilable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Types
CREATE TYPE journal_type AS ENUM ('sales', 'purchases', 'cash', 'bank', 'misc');

-- Journals
CREATE TABLE journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type journal_type NOT NULL,
  default_debit_account_id UUID REFERENCES accounts(id),
  default_credit_account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting Periods
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting Move Status
CREATE TYPE move_status AS ENUM ('draft', 'posted');

-- Accounting Moves (Journal Entries)
CREATE TABLE account_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  journal_id UUID REFERENCES journals(id) NOT NULL,
  ref TEXT,
  state move_status DEFAULT 'draft',
  period_id UUID REFERENCES periods(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting Move Lines
CREATE TABLE account_move_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID REFERENCES account_moves(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) NOT NULL,
  partner_id UUID REFERENCES partners(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'CDF',
  amount_currency NUMERIC DEFAULT 0,
  tax_id UUID REFERENCES taxes(id),
  maturity_date DATE,
  reconciled_group_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================
-- SEQUENCES FOR NUMBERING
-- ====================================

CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  padding INTEGER DEFAULT 4,
  current INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sequences
INSERT INTO sequences (code, prefix, padding, current) VALUES 
  ('sale.order', 'DEV-', 4, 0),
  ('invoice', 'FAC-', 4, 0),
  ('payment', 'PAY-', 4, 0),
  ('stock.move', 'MVT-', 4, 0),
  ('account.move', 'JE-', 4, 0);

-- ====================================
-- ENABLE RLS ON ALL TABLES
-- ====================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE uom ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_quants ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_move_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- ====================================
-- RLS POLICIES (Authenticated users can access all data for v1)
-- ====================================

-- Companies
CREATE POLICY "Authenticated users can view companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update companies" ON companies FOR UPDATE TO authenticated USING (true);

-- Partners
CREATE POLICY "Authenticated users can view partners" ON partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert partners" ON partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update partners" ON partners FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete partners" ON partners FOR DELETE TO authenticated USING (true);

-- Product Categories
CREATE POLICY "Authenticated users can view product_categories" ON product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_categories" ON product_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_categories" ON product_categories FOR UPDATE TO authenticated USING (true);

-- UoM
CREATE POLICY "Authenticated users can view uom" ON uom FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert uom" ON uom FOR INSERT TO authenticated WITH CHECK (true);

-- Taxes
CREATE POLICY "Authenticated users can view taxes" ON taxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert taxes" ON taxes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update taxes" ON taxes FOR UPDATE TO authenticated USING (true);

-- Products
CREATE POLICY "Authenticated users can view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete products" ON products FOR DELETE TO authenticated USING (true);

-- CRM Pipelines
CREATE POLICY "Authenticated users can view pipelines" ON crm_pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pipelines" ON crm_pipelines FOR INSERT TO authenticated WITH CHECK (true);

-- CRM Stages
CREATE POLICY "Authenticated users can view stages" ON crm_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stages" ON crm_stages FOR INSERT TO authenticated WITH CHECK (true);

-- CRM Leads
CREATE POLICY "Authenticated users can view leads" ON crm_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads" ON crm_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads" ON crm_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete leads" ON crm_leads FOR DELETE TO authenticated USING (true);

-- Sale Orders
CREATE POLICY "Authenticated users can view sale_orders" ON sale_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sale_orders" ON sale_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sale_orders" ON sale_orders FOR UPDATE TO authenticated USING (true);

-- Sale Order Lines
CREATE POLICY "Authenticated users can view sale_order_lines" ON sale_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sale_order_lines" ON sale_order_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sale_order_lines" ON sale_order_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sale_order_lines" ON sale_order_lines FOR DELETE TO authenticated USING (true);

-- Invoices
CREATE POLICY "Authenticated users can view invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoices" ON invoices FOR UPDATE TO authenticated USING (true);

-- Invoice Lines
CREATE POLICY "Authenticated users can view invoice_lines" ON invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoice_lines" ON invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoice_lines" ON invoice_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete invoice_lines" ON invoice_lines FOR DELETE TO authenticated USING (true);

-- Payments
CREATE POLICY "Authenticated users can view payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON payments FOR UPDATE TO authenticated USING (true);

-- Stock Locations
CREATE POLICY "Authenticated users can view stock_locations" ON stock_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_locations" ON stock_locations FOR INSERT TO authenticated WITH CHECK (true);

-- Stock Moves
CREATE POLICY "Authenticated users can view stock_moves" ON stock_moves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_moves" ON stock_moves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_moves" ON stock_moves FOR UPDATE TO authenticated USING (true);

-- Stock Quants
CREATE POLICY "Authenticated users can view stock_quants" ON stock_quants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_quants" ON stock_quants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_quants" ON stock_quants FOR UPDATE TO authenticated USING (true);

-- Accounts
CREATE POLICY "Authenticated users can view accounts" ON accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert accounts" ON accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update accounts" ON accounts FOR UPDATE TO authenticated USING (true);

-- Journals
CREATE POLICY "Authenticated users can view journals" ON journals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert journals" ON journals FOR INSERT TO authenticated WITH CHECK (true);

-- Periods
CREATE POLICY "Authenticated users can view periods" ON periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert periods" ON periods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update periods" ON periods FOR UPDATE TO authenticated USING (true);

-- Account Moves
CREATE POLICY "Authenticated users can view account_moves" ON account_moves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert account_moves" ON account_moves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update account_moves" ON account_moves FOR UPDATE TO authenticated USING (true);

-- Account Move Lines
CREATE POLICY "Authenticated users can view account_move_lines" ON account_move_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert account_move_lines" ON account_move_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update account_move_lines" ON account_move_lines FOR UPDATE TO authenticated USING (true);

-- Sequences
CREATE POLICY "Authenticated users can view sequences" ON sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update sequences" ON sequences FOR UPDATE TO authenticated USING (true);