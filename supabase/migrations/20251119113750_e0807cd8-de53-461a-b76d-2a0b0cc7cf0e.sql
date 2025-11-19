-- Corriger les politiques RLS pour activation_keys
-- Ne montrer que les clés de la société de l'utilisateur (pas les NULL)
DROP POLICY IF EXISTS "Admins can view own company activation keys" ON activation_keys;
DROP POLICY IF EXISTS "Admins can manage own company activation keys" ON activation_keys;

CREATE POLICY "Admins can view own company activation keys"
ON activation_keys FOR SELECT
USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id()
);

CREATE POLICY "Admins can manage own company activation keys"
ON activation_keys FOR ALL
USING (
  has_role(auth.uid(), 'admin') AND 
  company_id = get_user_company_id()
);

-- Mettre à jour la politique pour payment_attempts pour s'assurer qu'elle filtre correctement
DROP POLICY IF EXISTS "Users can view own company payment attempts" ON payment_attempts;
DROP POLICY IF EXISTS "Users can insert own company payment attempts" ON payment_attempts;

CREATE POLICY "Users can view own company payment attempts"
ON payment_attempts FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert own company payment attempts"
ON payment_attempts FOR INSERT
WITH CHECK (company_id = get_user_company_id());