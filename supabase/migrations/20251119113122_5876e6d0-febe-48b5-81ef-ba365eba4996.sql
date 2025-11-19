-- Add company_id to activation_keys table
ALTER TABLE activation_keys 
ADD COLUMN company_id UUID REFERENCES companies(id);

-- Create index for better performance
CREATE INDEX idx_activation_keys_company_id ON activation_keys(company_id);

-- Update RLS policies to filter by company
DROP POLICY IF EXISTS "Only admins can view activation keys" ON activation_keys;
DROP POLICY IF EXISTS "Only admins can manage activation keys" ON activation_keys;

CREATE POLICY "Admins can view own company activation keys"
ON activation_keys FOR SELECT
USING (
  has_role(auth.uid(), 'admin') AND 
  (company_id = get_user_company_id() OR company_id IS NULL)
);

CREATE POLICY "Admins can manage own company activation keys"
ON activation_keys FOR ALL
USING (
  has_role(auth.uid(), 'admin') AND 
  (company_id = get_user_company_id() OR company_id IS NULL)
);