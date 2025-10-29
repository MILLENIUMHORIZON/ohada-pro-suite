-- Fix duplicate company creation caused by profiles trigger
-- Update the function to only create a company when NEW.company_id is null
CREATE OR REPLACE FUNCTION public.handle_new_user_with_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_company_id uuid;
  company_name_value text;
BEGIN
  -- If company_id is already provided (e.g., set by handle_new_user on signup/admin create), do nothing
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Determine company name
  company_name_value := NEW.company_name;
  IF company_name_value IS NULL OR company_name_value = '' THEN
    company_name_value := NEW.full_name || '''s Company';
  END IF;

  -- Create the company only when missing
  INSERT INTO public.companies (name, currency, country)
  VALUES (company_name_value, 'CDF', 'CD')
  RETURNING id INTO new_company_id;

  -- Attach to the newly created company
  NEW.company_id := new_company_id;

  RETURN NEW;
END;
$$;