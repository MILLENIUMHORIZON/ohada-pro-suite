-- Create function to automatically create company and set company_id on profile insert
CREATE OR REPLACE FUNCTION public.handle_new_user_with_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_name_value text;
BEGIN
  -- Get company name from user metadata
  company_name_value := new.company_name;
  
  -- If no company name provided, use full_name's company
  IF company_name_value IS NULL OR company_name_value = '' THEN
    company_name_value := new.full_name || '''s Company';
  END IF;
  
  -- Create the company
  INSERT INTO public.companies (name)
  VALUES (company_name_value)
  RETURNING id INTO new_company_id;
  
  -- Set the company_id on the profile being inserted
  new.company_id := new_company_id;
  
  RETURN new;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_company_on_profile_insert ON public.profiles;

-- Create trigger on profiles to automatically create company
CREATE TRIGGER set_company_on_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_with_company();