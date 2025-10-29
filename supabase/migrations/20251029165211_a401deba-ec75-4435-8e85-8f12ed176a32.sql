-- Update the handle_new_user function to create a company on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_name_value text;
BEGIN
  -- Get company name from metadata, fallback to user's name + "'s Company"
  company_name_value := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    (NEW.raw_user_meta_data->>'full_name') || '''s Company'
  );

  -- Create a new company for the user
  INSERT INTO public.companies (name, currency, country)
  VALUES (company_name_value, 'CDF', 'CD')
  RETURNING id INTO new_company_id;

  -- Create user profile with the new company
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

  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;