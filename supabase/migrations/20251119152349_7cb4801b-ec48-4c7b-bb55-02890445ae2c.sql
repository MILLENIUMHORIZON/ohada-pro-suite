-- Add company_code to companies table
ALTER TABLE public.companies 
ADD COLUMN company_code TEXT UNIQUE;

-- Create function to generate unique company code
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM companies WHERE company_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create trigger to auto-generate company code on insert
CREATE OR REPLACE FUNCTION public.auto_generate_company_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_code IS NULL THEN
    NEW.company_code := generate_company_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_company_code
BEFORE INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_company_code();

-- Generate codes for existing companies
UPDATE public.companies
SET company_code = generate_company_code()
WHERE company_code IS NULL;

-- Add new columns to application_liaisons for external establishment info
ALTER TABLE public.application_liaisons
ADD COLUMN code_etablissement TEXT,
ADD COLUMN nom_etablissement TEXT,
ADD COLUMN type_etablissement TEXT,
ADD COLUMN administrateur_etablissement TEXT,
ADD COLUMN phone_etablissement TEXT;

-- Create index on company_code for faster lookups
CREATE INDEX idx_companies_company_code ON public.companies(company_code);