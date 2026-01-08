
-- Create enum for default fund request statuses
CREATE TYPE public.fund_request_status AS ENUM (
  'draft',
  'submitted',
  'accounting_review',
  'validated',
  'rejected',
  'paid'
);

-- Create fund_requests table
CREATE TABLE public.fund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  beneficiary TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CDF',
  description TEXT NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status fund_request_status NOT NULL DEFAULT 'draft',
  current_step_id UUID,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, request_number)
);

-- Create workflow_steps table for configurable workflow
CREATE TABLE public.workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  responsible_role TEXT NOT NULL,
  allowed_actions TEXT[] NOT NULL DEFAULT ARRAY['approve', 'reject'],
  required_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, step_order)
);

-- Create fund_request_accounting table
CREATE TABLE public.fund_request_accounting (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_request_id UUID NOT NULL REFERENCES public.fund_requests(id) ON DELETE CASCADE,
  expense_account_id UUID REFERENCES public.accounts(id),
  treasury_account_id UUID REFERENCES public.accounts(id),
  third_party_account_id UUID REFERENCES public.accounts(id),
  accountant_id UUID REFERENCES auth.users(id),
  accounting_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fund_request_history table for audit trail
CREATE TABLE public.fund_request_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_request_id UUID NOT NULL REFERENCES public.fund_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status fund_request_status,
  to_status fund_request_status,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_by_name TEXT,
  step_id UUID REFERENCES public.workflow_steps(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_receipts table
CREATE TABLE public.payment_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_request_id UUID NOT NULL REFERENCES public.fund_requests(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  beneficiary TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cashier_id UUID NOT NULL REFERENCES auth.users(id),
  cashier_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, receipt_number)
);

-- Enable RLS
ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_request_accounting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fund_requests
CREATE POLICY "Users can view fund requests from their company"
ON public.fund_requests FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create fund requests for their company"
ON public.fund_requests FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update fund requests from their company"
ON public.fund_requests FOR UPDATE
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- RLS Policies for workflow_steps
CREATE POLICY "Users can view workflow steps from their company"
ON public.workflow_steps FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage workflow steps"
ON public.workflow_steps FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- RLS Policies for fund_request_accounting
CREATE POLICY "Users can view accounting from their company"
ON public.fund_request_accounting FOR SELECT
USING (
  fund_request_id IN (
    SELECT fr.id FROM public.fund_requests fr
    WHERE fr.company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage accounting for their company"
ON public.fund_request_accounting FOR ALL
USING (
  fund_request_id IN (
    SELECT fr.id FROM public.fund_requests fr
    WHERE fr.company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- RLS Policies for fund_request_history
CREATE POLICY "Users can view history from their company"
ON public.fund_request_history FOR SELECT
USING (
  fund_request_id IN (
    SELECT fr.id FROM public.fund_requests fr
    WHERE fr.company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create history entries"
ON public.fund_request_history FOR INSERT
WITH CHECK (
  fund_request_id IN (
    SELECT fr.id FROM public.fund_requests fr
    WHERE fr.company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- RLS Policies for payment_receipts
CREATE POLICY "Users can view receipts from their company"
ON public.payment_receipts FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create receipts for their company"
ON public.payment_receipts FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- Function to get next fund request number
CREATE OR REPLACE FUNCTION public.get_next_fund_request_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := 'DF-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-';
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(request_number FROM LENGTH(year_prefix) + 1) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.fund_requests
  WHERE company_id = p_company_id
    AND request_number LIKE year_prefix || '%';
  
  RETURN year_prefix || LPAD(next_num::TEXT, 5, '0');
END;
$$;

-- Function to get next receipt number
CREATE OR REPLACE FUNCTION public.get_next_receipt_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := 'REC-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-';
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(receipt_number FROM LENGTH(year_prefix) + 1) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.payment_receipts
  WHERE company_id = p_company_id
    AND receipt_number LIKE year_prefix || '%';
  
  RETURN year_prefix || LPAD(next_num::TEXT, 5, '0');
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_fund_requests_updated_at
BEFORE UPDATE ON public.fund_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default workflow steps function
CREATE OR REPLACE FUNCTION public.create_default_workflow_steps(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if no steps exist for this company
  IF NOT EXISTS (SELECT 1 FROM public.workflow_steps WHERE company_id = p_company_id) THEN
    INSERT INTO public.workflow_steps (company_id, step_name, step_order, responsible_role, allowed_actions, required_fields) VALUES
    (p_company_id, 'Soumission', 1, 'requester', ARRAY['submit'], ARRAY[]::TEXT[]),
    (p_company_id, 'Revue Comptable', 2, 'accountant', ARRAY['approve', 'reject', 'complete_accounting'], ARRAY['expense_account', 'treasury_account']),
    (p_company_id, 'Validation', 3, 'manager', ARRAY['approve', 'reject'], ARRAY[]::TEXT[]),
    (p_company_id, 'Paiement', 4, 'cashier', ARRAY['pay', 'reject'], ARRAY[]::TEXT[]);
  END IF;
END;
$$;
