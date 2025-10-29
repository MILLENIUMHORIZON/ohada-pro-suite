-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;

-- Create a single comprehensive SELECT policy that allows:
-- 1. Users to view their own profile
-- 2. Admins to view all profiles in their company
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  auth.uid() = user_id
  OR
  -- Admins can see all profiles in their company
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND company_id = get_user_company_id()
  )
);