-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'demo', 'user', 'accountant', 'sales', 'stock_manager');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text NOT NULL,
  company_name text,
  phone text,
  account_type text DEFAULT 'demo',
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with 15 days demo
  INSERT INTO public.profiles (user_id, full_name, account_type, expires_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'demo',
    NOW() + INTERVAL '15 days'
  );
  
  -- Assign demo role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'demo');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create proforma table (for quotations to suppliers and customers)
CREATE TABLE public.proformas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('customer', 'supplier')),
  partner_id uuid REFERENCES public.partners(id) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  currency text DEFAULT 'CDF',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted')),
  total_ht numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  notes text,
  converted_to_order_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view proformas"
  ON public.proformas FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert proformas"
  ON public.proformas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update proformas"
  ON public.proformas FOR UPDATE
  USING (true);

-- Create proforma_lines table
CREATE TABLE public.proforma_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id uuid REFERENCES public.proformas(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  description text,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_id uuid REFERENCES public.taxes(id),
  subtotal numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proforma_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view proforma_lines"
  ON public.proforma_lines FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage proforma_lines"
  ON public.proforma_lines FOR ALL
  USING (true);

-- Create procurement (approvisionnement) table
CREATE TABLE public.procurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  supplier_id uuid REFERENCES public.partners(id),
  qty_needed numeric NOT NULL,
  qty_ordered numeric DEFAULT 0,
  qty_received numeric DEFAULT 0,
  date_needed date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'partial', 'done', 'cancelled')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view procurements"
  ON public.procurements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage procurements"
  ON public.procurements FOR ALL
  USING (true);

-- Create stock_inventory table (for physical inventory)
CREATE TABLE public.stock_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  name text NOT NULL,
  location_id uuid REFERENCES public.stock_locations(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  state text DEFAULT 'draft' CHECK (state IN ('draft', 'in_progress', 'done', 'cancelled')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.stock_inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventories"
  ON public.stock_inventories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage inventories"
  ON public.stock_inventories FOR ALL
  USING (true);

-- Create stock_inventory_lines table
CREATE TABLE public.stock_inventory_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid REFERENCES public.stock_inventories(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  location_id uuid REFERENCES public.stock_locations(id) NOT NULL,
  theoretical_qty numeric DEFAULT 0,
  counted_qty numeric,
  difference numeric,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.stock_inventory_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage inventory_lines"
  ON public.stock_inventory_lines FOR ALL
  USING (true);

-- Insert demo sequences
INSERT INTO public.sequences (code, prefix, current, padding)
VALUES 
  ('proforma', 'PRO-2025-', 0, 4),
  ('procurement', 'APP-2025-', 0, 4),
  ('inventory', 'INV-2025-', 0, 4)
ON CONFLICT (code) DO NOTHING;