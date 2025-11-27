-- Create function to insert default RDC tax groups
CREATE OR REPLACE FUNCTION public.insert_default_taxes_rdc(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert default RDC tax groups
  INSERT INTO taxes (company_id, name, rate) VALUES
  (p_company_id, 'Groupe A - TVA normale', 16.0),
  (p_company_id, 'Groupe B - TVA réduite', 0.0),
  (p_company_id, 'Groupe C - Exonérés', 0.0),
  (p_company_id, 'Groupe D - Exportations', 0.0);
  
  RAISE NOTICE 'Taxes par défaut RDC insérées pour company_id: %', p_company_id;
END;
$function$;

-- Modify the auto_insert_ohada_chart trigger function to also insert default taxes for RDC companies
CREATE OR REPLACE FUNCTION public.auto_insert_ohada_chart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
  
  RETURN NEW;
END;
$function$;