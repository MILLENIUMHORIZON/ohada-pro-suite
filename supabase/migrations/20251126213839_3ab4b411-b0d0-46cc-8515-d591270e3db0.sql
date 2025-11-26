-- Add currency field to products table
ALTER TABLE products ADD COLUMN currency text DEFAULT 'CDF';

-- Add comment
COMMENT ON COLUMN products.currency IS 'Currency code for product pricing';