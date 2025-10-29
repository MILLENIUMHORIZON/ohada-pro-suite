-- Fix unique constraint on uom table to be company-specific
-- The constraint should be on (company_id, code) not just (code)

-- Drop the existing constraint if it exists
ALTER TABLE uom DROP CONSTRAINT IF EXISTS uom_code_key;

-- Add the correct unique constraint per company
ALTER TABLE uom ADD CONSTRAINT uom_company_code_unique UNIQUE (company_id, code);