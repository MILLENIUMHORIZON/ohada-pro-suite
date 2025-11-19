-- Supprimer les anciennes policies sur payment_attempts
DROP POLICY IF EXISTS "Admins can view all payment attempts" ON payment_attempts;
DROP POLICY IF EXISTS "Users can insert own company payment attempts" ON payment_attempts;
DROP POLICY IF EXISTS "Users can view own company payment attempts" ON payment_attempts;

-- Recréer des policies plus strictes
CREATE POLICY "Users can view only their company payment attempts"
ON payment_attempts
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Users can insert only their company payment attempts"
ON payment_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Admins can view their company payment attempts"
ON payment_attempts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);