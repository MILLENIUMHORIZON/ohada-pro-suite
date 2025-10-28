-- Add account_id column to partners table
ALTER TABLE partners
ADD COLUMN account_id UUID REFERENCES accounts(id);

COMMENT ON COLUMN partners.account_id IS 'Compte comptable associé au partenaire';