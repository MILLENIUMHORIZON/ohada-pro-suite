-- Create function to insert default invoice sequences
CREATE OR REPLACE FUNCTION insert_default_invoice_sequences(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default invoice sequences if they don't exist
  INSERT INTO sequences (company_id, code, prefix, padding, current)
  VALUES
    (p_company_id, 'FV', 'FV-', 4, 0),
    (p_company_id, 'EV', 'EV-', 4, 0),
    (p_company_id, 'FT', 'FT-', 4, 0),
    (p_company_id, 'EA', 'EA-', 4, 0),
    (p_company_id, 'FA', 'FA-', 4, 0),
    (p_company_id, 'ET', 'ET-', 4, 0)
  ON CONFLICT (company_id, code) DO NOTHING;
  
  RAISE NOTICE 'Séquences de factures insérées pour company_id: %', p_company_id;
END;
$$;

-- Update the auto_insert_ohada_chart function to also insert invoice sequences
CREATE OR REPLACE FUNCTION auto_insert_ohada_chart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert OHADA chart for the new company
  BEGIN
    PERFORM insert_ohada_chart(NEW.id);
    RAISE NOTICE 'Plan comptable OHADA inséré avec succès pour company_id: %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Échec de l''insertion du plan OHADA pour company_id %: %', NEW.id, SQLERRM;
  END;
  
  -- Insert default taxes for RDC companies
  IF NEW.country = 'CD' THEN
    BEGIN
      PERFORM insert_default_taxes_rdc(NEW.id);
      RAISE NOTICE 'Taxes par défaut RDC insérées avec succès pour company_id: %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Échec de l''insertion des taxes RDC pour company_id %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  -- Insert default invoice sequences
  BEGIN
    PERFORM insert_default_invoice_sequences(NEW.id);
    RAISE NOTICE 'Séquences de factures insérées avec succès pour company_id: %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Échec de l''insertion des séquences pour company_id %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Insert sequences for existing companies that don't have them
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies LOOP
    PERFORM insert_default_invoice_sequences(company_record.id);
  END LOOP;
END $$;