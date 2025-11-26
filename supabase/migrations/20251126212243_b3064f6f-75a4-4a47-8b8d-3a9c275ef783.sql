-- Rendre le champ country obligatoire dans la table companies
ALTER TABLE companies 
ALTER COLUMN country SET NOT NULL,
ALTER COLUMN country SET DEFAULT 'CD';

-- Mettre à jour la fonction handle_new_user pour utiliser le pays depuis les métadonnées
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
    
    -- Get country from metadata, default to CD (RDC) if not provided
    country_code := COALESCE(NEW.raw_user_meta_data->>'country', 'CD');

    INSERT INTO public.companies (name, currency, country)
    VALUES (company_name_value, 'CDF', country_code)
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
$function$;