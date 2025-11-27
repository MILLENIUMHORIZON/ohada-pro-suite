-- Add column to store complete DGI normalization response data
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS dgi_normalization_data JSONB;