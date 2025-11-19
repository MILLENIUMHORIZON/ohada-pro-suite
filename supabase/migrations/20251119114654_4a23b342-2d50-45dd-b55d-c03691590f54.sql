-- Recréer la fonction get_user_company_id avec CREATE OR REPLACE (sans DROP)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Ajouter une fonction de debug pour tester
CREATE OR REPLACE FUNCTION public.debug_user_context()
RETURNS TABLE(auth_user_id uuid, profile_company_id uuid, profile_exists boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    auth.uid() as auth_user_id,
    (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) as profile_company_id,
    EXISTS(SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) as profile_exists
$$;