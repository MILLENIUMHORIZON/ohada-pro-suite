-- Create fund request lines table
CREATE TABLE public.fund_request_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_request_id UUID NOT NULL REFERENCES public.fund_requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fund_request_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for fund_request_lines
CREATE POLICY "Users can view fund request lines for their company"
  ON public.fund_request_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fund_requests fr
      JOIN public.profiles p ON p.company_id = fr.company_id
      WHERE fr.id = fund_request_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fund request lines"
  ON public.fund_request_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fund_requests fr
      JOIN public.profiles p ON p.company_id = fr.company_id
      WHERE fr.id = fund_request_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fund request lines"
  ON public.fund_request_lines
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fund_requests fr
      JOIN public.profiles p ON p.company_id = fr.company_id
      WHERE fr.id = fund_request_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete fund request lines"
  ON public.fund_request_lines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.fund_requests fr
      JOIN public.profiles p ON p.company_id = fr.company_id
      WHERE fr.id = fund_request_id AND p.user_id = auth.uid()
    )
  );