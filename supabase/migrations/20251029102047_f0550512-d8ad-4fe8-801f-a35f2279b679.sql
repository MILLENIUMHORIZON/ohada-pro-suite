-- Add missing WITH CHECK policies for currencies (handle duplicates safely)
DO $$ BEGIN
  CREATE POLICY "Users can insert own company currencies"
  ON public.currencies
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own company currencies"
  ON public.currencies
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;