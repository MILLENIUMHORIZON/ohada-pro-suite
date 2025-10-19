-- Add company_id to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Create security definer function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Update handle_new_user trigger to create a default company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Create a default company for the new user
  INSERT INTO public.companies (name, currency)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User') || '''s Company',
    'CDF'
  )
  RETURNING id INTO new_company_id;
  
  -- Insert profile with 15 days demo and link to company
  INSERT INTO public.profiles (user_id, full_name, account_type, expires_at, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'demo',
    NOW() + INTERVAL '15 days',
    new_company_id
  );
  
  -- Assign demo role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'demo');
  
  RETURN NEW;
END;
$$;

-- Drop existing RLS policies and recreate with company isolation

-- Companies table
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;

CREATE POLICY "Users can view own company"
ON public.companies FOR SELECT
USING (id = public.get_user_company_id());

CREATE POLICY "Users can update own company"
ON public.companies FOR UPDATE
USING (id = public.get_user_company_id());

-- Partners table
DROP POLICY IF EXISTS "Authenticated users can view partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON public.partners;

CREATE POLICY "Users can view own company partners"
ON public.partners FOR SELECT
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert own company partners"
ON public.partners FOR INSERT
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update own company partners"
ON public.partners FOR UPDATE
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete own company partners"
ON public.partners FOR DELETE
USING (company_id = public.get_user_company_id());

-- Products table (add company_id if not exists)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

CREATE POLICY "Users can view own company products"
ON public.products FOR SELECT
USING (company_id = public.get_user_company_id() OR company_id IS NULL);

CREATE POLICY "Users can insert own company products"
ON public.products FOR INSERT
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update own company products"
ON public.products FOR UPDATE
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete own company products"
ON public.products FOR DELETE
USING (company_id = public.get_user_company_id());

-- Invoices table (add company_id via join with partners)
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;

CREATE POLICY "Users can view own company invoices"
ON public.invoices FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = invoices.partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can insert own company invoices"
ON public.invoices FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can update own company invoices"
ON public.invoices FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = invoices.partner_id 
  AND p.company_id = public.get_user_company_id()
));

-- Sale Orders
DROP POLICY IF EXISTS "Authenticated users can view sale_orders" ON public.sale_orders;
DROP POLICY IF EXISTS "Authenticated users can insert sale_orders" ON public.sale_orders;
DROP POLICY IF EXISTS "Authenticated users can update sale_orders" ON public.sale_orders;

CREATE POLICY "Users can view own company sale_orders"
ON public.sale_orders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = sale_orders.partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can insert own company sale_orders"
ON public.sale_orders FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can update own company sale_orders"
ON public.sale_orders FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = sale_orders.partner_id 
  AND p.company_id = public.get_user_company_id()
));

-- Payments
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;

CREATE POLICY "Users can view own company payments"
ON public.payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = payments.partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can insert own company payments"
ON public.payments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can update own company payments"
ON public.payments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = payments.partner_id 
  AND p.company_id = public.get_user_company_id()
));

-- Proformas
DROP POLICY IF EXISTS "Authenticated users can view proformas" ON public.proformas;
DROP POLICY IF EXISTS "Authenticated users can insert proformas" ON public.proformas;
DROP POLICY IF EXISTS "Authenticated users can update proformas" ON public.proformas;

CREATE POLICY "Users can view own company proformas"
ON public.proformas FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = proformas.partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can insert own company proformas"
ON public.proformas FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = partner_id 
  AND p.company_id = public.get_user_company_id()
));

CREATE POLICY "Users can update own company proformas"
ON public.proformas FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.partners p 
  WHERE p.id = proformas.partner_id 
  AND p.company_id = public.get_user_company_id()
));

-- Procurements (add company_id)
ALTER TABLE public.procurements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

DROP POLICY IF EXISTS "Authenticated users can view procurements" ON public.procurements;
DROP POLICY IF EXISTS "Authenticated users can manage procurements" ON public.procurements;

CREATE POLICY "Users can view own company procurements"
ON public.procurements FOR SELECT
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage own company procurements"
ON public.procurements FOR ALL
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

-- CRM Leads (add company_id)
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.crm_leads;

CREATE POLICY "Users can view own company leads"
ON public.crm_leads FOR SELECT
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert own company leads"
ON public.crm_leads FOR INSERT
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update own company leads"
ON public.crm_leads FOR UPDATE
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete own company leads"
ON public.crm_leads FOR DELETE
USING (company_id = public.get_user_company_id());

-- Stock Inventories (add company_id)
ALTER TABLE public.stock_inventories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

DROP POLICY IF EXISTS "Authenticated users can view inventories" ON public.stock_inventories;
DROP POLICY IF EXISTS "Authenticated users can manage inventories" ON public.stock_inventories;

CREATE POLICY "Users can view own company inventories"
ON public.stock_inventories FOR SELECT
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage own company inventories"
ON public.stock_inventories FOR ALL
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());