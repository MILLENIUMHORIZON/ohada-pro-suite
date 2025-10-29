-- Fix profiles RLS to allow trigger to create profiles
-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create a new policy that allows:
-- 1. Users to insert their own profile
-- 2. Service role / triggers to insert profiles (SECURITY DEFINER functions bypass RLS, so this is safe)
CREATE POLICY "Allow profile creation"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to create their own profile
  auth.uid() = user_id
  OR
  -- Allow admins to create profiles for users in their company
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND company_id = get_user_company_id()
  )
);