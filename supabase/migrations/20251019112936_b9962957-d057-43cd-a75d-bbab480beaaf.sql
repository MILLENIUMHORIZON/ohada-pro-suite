-- Fix critical security issues: accounting isolation, line items isolation, and accounting move lines

-- =====================================================
-- PART 1: Add company_id to accounting tables
-- =====================================================

-- Add company_id to accounting tables
ALTER TABLE public.accounts ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.journals ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.account_moves ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.periods ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Backfill existing data with first company (or you can delete if test data)
UPDATE public.accounts SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.journals SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.account_moves SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.periods SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;

-- Make company_id NOT NULL
ALTER TABLE public.accounts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.journals ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.account_moves ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.periods ALTER COLUMN company_id SET NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_accounts_company ON public.accounts(company_id);
CREATE INDEX idx_journals_company ON public.journals(company_id);
CREATE INDEX idx_account_moves_company ON public.account_moves(company_id);
CREATE INDEX idx_periods_company ON public.periods(company_id);

-- =====================================================
-- PART 2: Update RLS policies for accounting tables
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON public.accounts;

DROP POLICY IF EXISTS "Authenticated users can insert journals" ON public.journals;
DROP POLICY IF EXISTS "Authenticated users can view journals" ON public.journals;

DROP POLICY IF EXISTS "Authenticated users can insert account_moves" ON public.account_moves;
DROP POLICY IF EXISTS "Authenticated users can update account_moves" ON public.account_moves;
DROP POLICY IF EXISTS "Authenticated users can view account_moves" ON public.account_moves;

DROP POLICY IF EXISTS "Authenticated users can insert account_move_lines" ON public.account_move_lines;
DROP POLICY IF EXISTS "Authenticated users can update account_move_lines" ON public.account_move_lines;
DROP POLICY IF EXISTS "Authenticated users can view account_move_lines" ON public.account_move_lines;

DROP POLICY IF EXISTS "Authenticated users can insert periods" ON public.periods;
DROP POLICY IF EXISTS "Authenticated users can update periods" ON public.periods;
DROP POLICY IF EXISTS "Authenticated users can view periods" ON public.periods;

-- Create company-scoped policies for accounts
CREATE POLICY "Users can view own company accounts"
ON public.accounts FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage own company accounts"
ON public.accounts FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

-- Create company-scoped policies for journals
CREATE POLICY "Users can view own company journals"
ON public.journals FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage own company journals"
ON public.journals FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

-- Create company-scoped policies for account_moves
CREATE POLICY "Users can view own company account_moves"
ON public.account_moves FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage own company account_moves"
ON public.account_moves FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

-- Create company-scoped policies for account_move_lines (join to account_moves)
CREATE POLICY "Users can view own company account_move_lines"
ON public.account_move_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.account_moves am
  WHERE am.id = account_move_lines.move_id
  AND am.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage own company account_move_lines"
ON public.account_move_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.account_moves am
  WHERE am.id = account_move_lines.move_id
  AND am.company_id = get_user_company_id()
));

-- Create company-scoped policies for periods
CREATE POLICY "Users can view own company periods"
ON public.periods FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage own company periods"
ON public.periods FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

-- =====================================================
-- PART 3: Fix line items RLS policies
-- =====================================================

-- Fix invoice_lines
DROP POLICY IF EXISTS "Authenticated users can view invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can insert invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can update invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can delete invoice_lines" ON public.invoice_lines;

CREATE POLICY "Users can view own company invoice_lines"
ON public.invoice_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices i
  JOIN public.partners p ON p.id = i.partner_id
  WHERE i.id = invoice_lines.invoice_id
  AND p.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage own company invoice_lines"
ON public.invoice_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices i
  JOIN public.partners p ON p.id = i.partner_id
  WHERE i.id = invoice_lines.invoice_id
  AND p.company_id = get_user_company_id()
));

-- Fix sale_order_lines
DROP POLICY IF EXISTS "Authenticated users can view sale_order_lines" ON public.sale_order_lines;
DROP POLICY IF EXISTS "Authenticated users can insert sale_order_lines" ON public.sale_order_lines;
DROP POLICY IF EXISTS "Authenticated users can update sale_order_lines" ON public.sale_order_lines;
DROP POLICY IF EXISTS "Authenticated users can delete sale_order_lines" ON public.sale_order_lines;

CREATE POLICY "Users can view own company sale_order_lines"
ON public.sale_order_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sale_orders so
  JOIN public.partners p ON p.id = so.partner_id
  WHERE so.id = sale_order_lines.order_id
  AND p.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage own company sale_order_lines"
ON public.sale_order_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sale_orders so
  JOIN public.partners p ON p.id = so.partner_id
  WHERE so.id = sale_order_lines.order_id
  AND p.company_id = get_user_company_id()
));

-- Fix proforma_lines
DROP POLICY IF EXISTS "Authenticated users can view proforma_lines" ON public.proforma_lines;
DROP POLICY IF EXISTS "Authenticated users can manage proforma_lines" ON public.proforma_lines;

CREATE POLICY "Users can view own company proforma_lines"
ON public.proforma_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proformas pf
  JOIN public.partners p ON p.id = pf.partner_id
  WHERE pf.id = proforma_lines.proforma_id
  AND p.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage own company proforma_lines"
ON public.proforma_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proformas pf
  JOIN public.partners p ON p.id = pf.partner_id
  WHERE pf.id = proforma_lines.proforma_id
  AND p.company_id = get_user_company_id()
));

-- Fix stock_inventory_lines (via stock_inventories which has company_id)
DROP POLICY IF EXISTS "Authenticated users can manage inventory_lines" ON public.stock_inventory_lines;

CREATE POLICY "Users can view own company stock_inventory_lines"
ON public.stock_inventory_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stock_inventories si
  WHERE si.id = stock_inventory_lines.inventory_id
  AND si.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage own company stock_inventory_lines"
ON public.stock_inventory_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stock_inventories si
  WHERE si.id = stock_inventory_lines.inventory_id
  AND si.company_id = get_user_company_id()
));