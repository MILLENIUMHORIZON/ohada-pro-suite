-- Create currencies table
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 1.0,
  is_base BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own company currencies"
  ON public.currencies
  FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage own company currencies"
  ON public.currencies
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Create index for better performance
CREATE INDEX idx_currencies_company_id ON public.currencies(company_id);