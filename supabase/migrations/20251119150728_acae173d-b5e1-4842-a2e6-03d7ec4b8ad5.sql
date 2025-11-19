-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create enum for application types
CREATE TYPE public.application_type AS ENUM ('loyambo_resto_hotel', 'millenium_payroll', 'other');

-- Create enum for liaison request status
CREATE TYPE public.liaison_status AS ENUM ('pending', 'approved', 'rejected', 'active');

-- Create table for application liaison requests
CREATE TABLE public.application_liaisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  application_type application_type NOT NULL,
  application_name TEXT NOT NULL,
  requested_by UUID NOT NULL,
  status liaison_status NOT NULL DEFAULT 'pending',
  request_message TEXT,
  response_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID
);

-- Enable RLS
ALTER TABLE public.application_liaisons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company liaison requests"
ON public.application_liaisons
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Users can create liaison requests for their company"
ON public.application_liaisons
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Admins can update liaison requests"
ON public.application_liaisons
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- Create index for faster queries
CREATE INDEX idx_application_liaisons_company ON application_liaisons(company_id);
CREATE INDEX idx_application_liaisons_status ON application_liaisons(status);

-- Create trigger for updated_at
CREATE TRIGGER update_application_liaisons_updated_at
BEFORE UPDATE ON public.application_liaisons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();