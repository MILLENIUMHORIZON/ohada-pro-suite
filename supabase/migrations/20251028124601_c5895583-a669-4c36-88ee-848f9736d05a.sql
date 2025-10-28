-- Create table for user module permissions
CREATE TABLE public.user_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can view all module permissions for their company users
CREATE POLICY "Admins can view company user permissions"
ON public.user_module_permissions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.user_id = auth.uid()
    AND p2.user_id = user_module_permissions.user_id
    AND p1.company_id = p2.company_id
  )
);

-- Admins can manage module permissions for their company users
CREATE POLICY "Admins can manage company user permissions"
ON public.user_module_permissions
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.user_id = auth.uid()
    AND p2.user_id = user_module_permissions.user_id
    AND p1.company_id = p2.company_id
  )
);

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_module_permissions
FOR SELECT
USING (user_id = auth.uid());