
-- 1. Add uom_type to uom table
ALTER TABLE public.uom ADD COLUMN IF NOT EXISTS uom_type text DEFAULT 'quantity';

-- 2. Add image_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications text;

-- 3. Add image_url and workshop to step_machines  
ALTER TABLE public.step_machines ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.step_machines ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.step_machines ADD COLUMN IF NOT EXISTS workshop text;

-- 4. Add step_id to bom_lines to link materials to specific BOM steps
ALTER TABLE public.bom_lines ADD COLUMN IF NOT EXISTS bom_step_id uuid REFERENCES public.bom_steps(id) ON DELETE SET NULL;

-- 5. Create manufacturing_order_steps table for tracking step progress
CREATE TABLE IF NOT EXISTS public.manufacturing_order_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  bom_step_id uuid REFERENCES public.bom_steps(id) ON DELETE SET NULL,
  step_order integer NOT NULL DEFAULT 1,
  step_name text NOT NULL,
  step_code text,
  duration_minutes integer NOT NULL DEFAULT 0,
  actual_duration_minutes integer,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  started_by uuid,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manufacturing_order_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their company order steps" ON public.manufacturing_order_steps
FOR ALL TO public
USING (
  EXISTS (
    SELECT 1 FROM public.manufacturing_orders mo
    WHERE mo.id = manufacturing_order_steps.order_id
    AND mo.company_id = get_user_company_id()
  )
);

-- 6. Create manufacturing_order_consumptions for tracking per-step material usage
CREATE TABLE IF NOT EXISTS public.manufacturing_order_consumptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  order_step_id uuid REFERENCES public.manufacturing_order_steps(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  consumed_by uuid,
  stock_move_id uuid REFERENCES public.stock_moves(id)
);

ALTER TABLE public.manufacturing_order_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their company consumptions" ON public.manufacturing_order_consumptions
FOR ALL TO public
USING (
  EXISTS (
    SELECT 1 FROM public.manufacturing_orders mo
    WHERE mo.id = manufacturing_order_consumptions.order_id
    AND mo.company_id = get_user_company_id()
  )
);

-- 7. Storage bucket for production images
INSERT INTO storage.buckets (id, name, public) VALUES ('production-images', 'production-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for production-images
CREATE POLICY "Anyone can view production images" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'production-images');

CREATE POLICY "Authenticated users can upload production images" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'production-images');

CREATE POLICY "Authenticated users can update production images" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'production-images');

CREATE POLICY "Authenticated users can delete production images" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'production-images');

-- 8. Enable realtime for manufacturing_order_steps
ALTER PUBLICATION supabase_realtime ADD TABLE public.manufacturing_order_steps;
