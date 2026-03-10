
-- Create step_machines table for multiple machines per production step
CREATE TABLE public.step_machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.production_steps(id) ON DELETE CASCADE,
  machine_name VARCHAR NOT NULL,
  hourly_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.step_machines ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage machines for steps in their company
CREATE POLICY "Users can manage step machines"
ON public.step_machines
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.production_steps ps
    WHERE ps.id = step_machines.step_id
    AND ps.company_id = get_user_company_id()
  )
);
