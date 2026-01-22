-- Create table for workflow step user assignments
CREATE TABLE public.workflow_step_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (workflow_step_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workflow_step_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view workflow step users in their company"
  ON public.workflow_step_users FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage workflow step users"
  ON public.workflow_step_users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create function to get account balance (treasury accounts)
CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
  INTO v_balance
  FROM account_move_lines
  WHERE account_id = p_account_id;
  
  RETURN v_balance;
END;
$$;

-- Create function to check if user can perform workflow action
CREATE OR REPLACE FUNCTION public.can_perform_workflow_action(
  p_user_id UUID,
  p_step_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_is_assigned BOOLEAN := FALSE;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- For requester role, everyone can submit
  IF p_role = 'requester' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is assigned to this step
  SELECT EXISTS (
    SELECT 1 FROM workflow_step_users 
    WHERE workflow_step_id = p_step_id AND user_id = p_user_id
  ) INTO v_is_assigned;
  
  RETURN v_is_assigned;
END;
$$;