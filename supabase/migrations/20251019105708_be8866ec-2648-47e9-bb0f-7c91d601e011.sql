-- Fix companies table RLS to prevent public access
-- The issue: policies apply to 'public' role which includes anonymous users
-- Solution: Recreate policies to apply only to 'authenticated' role

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
DROP POLICY IF EXISTS "Users can update own company" ON public.companies;

-- Recreate with authenticated role only and additional auth check
CREATE POLICY "Authenticated users can view own company"
ON public.companies FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND id = get_user_company_id()
);

CREATE POLICY "Authenticated users can update own company"
ON public.companies FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND id = get_user_company_id()
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND id = get_user_company_id()
);