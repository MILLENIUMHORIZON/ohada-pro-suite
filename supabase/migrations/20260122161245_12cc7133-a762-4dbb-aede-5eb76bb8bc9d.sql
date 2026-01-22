-- Drop the unique constraint on number only
ALTER TABLE public.account_moves DROP CONSTRAINT IF EXISTS account_moves_number_key;

-- Create a new unique constraint on (number, company_id) to allow same number in different companies
ALTER TABLE public.account_moves ADD CONSTRAINT account_moves_number_company_key UNIQUE (number, company_id);