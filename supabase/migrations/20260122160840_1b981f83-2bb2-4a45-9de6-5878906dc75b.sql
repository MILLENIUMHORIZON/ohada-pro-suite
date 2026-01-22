-- Drop the unique constraint on code only
ALTER TABLE public.journals DROP CONSTRAINT IF EXISTS journals_code_key;

-- Create a new unique constraint on (code, company_id) to allow same code in different companies
ALTER TABLE public.journals ADD CONSTRAINT journals_code_company_key UNIQUE (code, company_id);