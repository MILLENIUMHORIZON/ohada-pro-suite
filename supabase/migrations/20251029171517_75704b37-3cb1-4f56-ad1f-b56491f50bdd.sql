-- Update handle_new_user to support two flows:
-- 1. Signup: creates new company + admin role
-- 2. Admin creating user: uses existing company from metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_name_value text;
  user_role app_role;
BEGIN
  -- Check if company_id is provided in metadata (admin creating user)
  IF NEW.raw_user_meta_data ? 'company_id' THEN
    -- Admin creating user within existing company
    new_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
    company_name_value := COALESCE(
      NEW.raw_user_meta_data->>'company_name',
      ''
    );
    user_role := 'user'; -- Default role for admin-created users
    
  ELSE
    -- Signup flow: create new company
    company_name_value := COALESCE(
      NEW.raw_user_meta_data->>'company_name',
      (NEW.raw_user_meta_data->>'full_name') || '''s Company'
    );

    INSERT INTO public.companies (name, currency, country)
    VALUES (company_name_value, 'CDF', 'CD')
    RETURNING id INTO new_company_id;
    
    user_role := 'admin'; -- Admin role for signup
  END IF;

  -- Create user profile
  INSERT INTO public.profiles (
    user_id,
    full_name,
    phone,
    company_id,
    company_name,
    account_type,
    expires_at
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    new_company_id,
    company_name_value,
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'demo'),
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'account_type', 'demo') = 'demo' 
      THEN NOW() + INTERVAL '15 days'
      ELSE NULL
    END
  );

  -- Assign role (admin for signup, user for admin-created)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  RETURN NEW;
END;
$$;