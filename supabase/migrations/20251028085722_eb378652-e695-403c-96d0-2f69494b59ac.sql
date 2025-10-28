-- Add missing columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CD',
ADD COLUMN IF NOT EXISTS registration_number TEXT DEFAULT '';

-- Add comment to clarify columns
COMMENT ON COLUMN public.companies.country IS 'Country code (ISO 3166-1 alpha-2)';
COMMENT ON COLUMN public.companies.registration_number IS 'Company registration number (RCCM, etc.)';