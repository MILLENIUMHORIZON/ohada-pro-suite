-- Add company_id to payment_attempts table
ALTER TABLE payment_attempts 
ADD COLUMN company_id UUID REFERENCES companies(id);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own payment attempts" ON payment_attempts;
DROP POLICY IF EXISTS "Users can insert own payment attempts" ON payment_attempts;
DROP POLICY IF EXISTS "Admins can view all payment attempts" ON payment_attempts;

-- Create new RLS policies based on company_id
CREATE POLICY "Users can view own company payment attempts"
ON payment_attempts FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert own company payment attempts"
ON payment_attempts FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Admins can view all payment attempts"
ON payment_attempts FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Update existing payment attempts to have company_id from user's profile
UPDATE payment_attempts pa
SET company_id = (
  SELECT company_id 
  FROM profiles p 
  WHERE p.user_id = pa.user_id
)
WHERE company_id IS NULL;