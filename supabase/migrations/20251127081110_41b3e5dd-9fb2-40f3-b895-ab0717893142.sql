-- Add invoice type code field to invoices table
ALTER TABLE invoices ADD COLUMN invoice_type_code text;

-- Create sequences for each invoice type
INSERT INTO sequences (company_id, code, prefix, padding) 
SELECT id, 'FV', 'FV', 4 FROM companies WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE code = 'FV' AND company_id = companies.id
);

INSERT INTO sequences (company_id, code, prefix, padding) 
SELECT id, 'EV', 'EV', 4 FROM companies WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE code = 'EV' AND company_id = companies.id
);

INSERT INTO sequences (company_id, code, prefix, padding) 
SELECT id, 'FT', 'FT', 4 FROM companies WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE code = 'FT' AND company_id = companies.id
);

INSERT INTO sequences (company_id, code, prefix, padding) 
SELECT id, 'FA', 'FA', 4 FROM companies WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE code = 'FA' AND company_id = companies.id
);

INSERT INTO sequences (company_id, code, prefix, padding) 
SELECT id, 'EA', 'EA', 4 FROM companies WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE code = 'EA' AND company_id = companies.id
);

INSERT INTO sequences (company_id, code, prefix, padding) 
SELECT id, 'ET', 'ET', 4 FROM companies WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE code = 'ET' AND company_id = companies.id
);

-- Update auto generate invoice number function to use invoice_type_code
CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_sequence_code TEXT;
BEGIN
  -- Get company_id from partner
  SELECT p.company_id INTO v_company_id
  FROM partners p
  WHERE p.id = NEW.partner_id;
  
  -- Determine sequence code based on invoice_type_code
  v_sequence_code := COALESCE(NEW.invoice_type_code, 'FV');
  
  -- Generate number if not provided
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := get_next_sequence_number(v_company_id, v_sequence_code);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment
COMMENT ON COLUMN invoices.invoice_type_code IS 'Code type de facture: FV, EV, FT, FA, EA, ET';