-- Modifier le trigger pour qu'il ne bloque pas la création de company si l'insertion OHADA échoue
CREATE OR REPLACE FUNCTION auto_insert_ohada_chart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert OHADA chart for the new company
  -- Use exception handling to prevent blocking company creation if OHADA insert fails
  BEGIN
    PERFORM insert_ohada_chart(NEW.id);
    RAISE NOTICE 'Plan comptable OHADA inséré avec succès pour company_id: %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't block company creation
      RAISE WARNING 'Échec de l''insertion du plan OHADA pour company_id %: %', NEW.id, SQLERRM;
      -- Continue with company creation
  END;
  
  RETURN NEW;
END;
$$;