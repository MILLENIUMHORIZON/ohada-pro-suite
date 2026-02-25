
-- Production Steps table
CREATE TABLE public.production_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  machine VARCHAR(200),
  labor_required INTEGER NOT NULL DEFAULT 1,
  machine_hourly_cost NUMERIC NOT NULL DEFAULT 0,
  labor_hourly_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage production steps in their company"
  ON public.production_steps FOR ALL
  USING (company_id = get_user_company_id());

-- Bill of Materials table
CREATE TABLE public.bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_duration_minutes INTEGER NOT NULL DEFAULT 0,
  total_estimated_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage BOMs in their company"
  ON public.bill_of_materials FOR ALL
  USING (company_id = get_user_company_id());

-- BOM Lines (materials needed)
CREATE TABLE public.bom_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage BOM lines"
  ON public.bom_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_id AND b.company_id = get_user_company_id()));

-- BOM Steps (production steps for this BOM)
CREATE TABLE public.bom_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.production_steps(id),
  step_order INTEGER NOT NULL DEFAULT 1,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bom_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage BOM steps"
  ON public.bom_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_id AND b.company_id = get_user_company_id()));

-- Manufacturing Orders table
CREATE TABLE public.manufacturing_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  number VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  bom_id UUID REFERENCES public.bill_of_materials(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  launch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completion_date DATE,
  responsible VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  actual_duration_minutes INTEGER,
  actual_cost NUMERIC,
  waste_qty NUMERIC DEFAULT 0,
  waste_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage manufacturing orders in their company"
  ON public.manufacturing_orders FOR ALL
  USING (company_id = get_user_company_id());

-- Triggers for updated_at
CREATE TRIGGER update_production_steps_updated_at BEFORE UPDATE ON public.production_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bom_updated_at BEFORE UPDATE ON public.bill_of_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_manufacturing_orders_updated_at BEFORE UPDATE ON public.manufacturing_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
