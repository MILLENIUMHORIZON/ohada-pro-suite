
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  company_name_value text;
  user_role app_role;
  country_code text;
  v_expires_at timestamptz;
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
    
    -- Inherit license expiration from metadata (set by admin's edge function)
    IF NEW.raw_user_meta_data ? 'expires_at' AND NEW.raw_user_meta_data->>'expires_at' IS NOT NULL THEN
      v_expires_at := (NEW.raw_user_meta_data->>'expires_at')::timestamptz;
    ELSE
      -- Fallback: get expires_at from the admin's profile (any admin in same company)
      SELECT p.expires_at INTO v_expires_at
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.company_id = new_company_id AND ur.role = 'admin'
      LIMIT 1;
    END IF;
    
  ELSE
    -- Signup flow: create new company
    company_name_value := COALESCE(
      NEW.raw_user_meta_data->>'company_name',
      (NEW.raw_user_meta_data->>'full_name') || '''s Company'
    );
    
    country_code := COALESCE(NEW.raw_user_meta_data->>'country', 'CD');

    INSERT INTO public.companies (name, currency, country)
    VALUES (company_name_value, 'CDF', country_code)
    RETURNING id INTO new_company_id;
    
    user_role := 'admin';
    
    -- Demo accounts expire in 15 days
    IF COALESCE(NEW.raw_user_meta_data->>'account_type', 'demo') = 'demo' THEN
      v_expires_at := NOW() + INTERVAL '15 days';
    ELSE
      v_expires_at := NULL;
    END IF;
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
    v_expires_at
  );

  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  RETURN NEW;
END;
$function$;
