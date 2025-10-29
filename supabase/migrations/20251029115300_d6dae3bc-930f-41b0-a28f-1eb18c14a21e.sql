-- Create companies for existing profiles without company_id
DO $$
DECLARE
  profile_record RECORD;
  new_company_id uuid;
  company_name_value text;
BEGIN
  -- Loop through all profiles without company_id
  FOR profile_record IN 
    SELECT id, user_id, full_name, company_name 
    FROM public.profiles 
    WHERE company_id IS NULL
  LOOP
    -- Determine company name
    IF profile_record.company_name IS NOT NULL AND profile_record.company_name != '' THEN
      company_name_value := profile_record.company_name;
    ELSE
      company_name_value := profile_record.full_name || '''s Company';
    END IF;
    
    -- Create the company
    INSERT INTO public.companies (name)
    VALUES (company_name_value)
    RETURNING id INTO new_company_id;
    
    -- Update the profile with the new company_id
    UPDATE public.profiles
    SET company_id = new_company_id
    WHERE id = profile_record.id;
    
    RAISE NOTICE 'Created company % for profile %', new_company_id, profile_record.id;
  END LOOP;
END $$;