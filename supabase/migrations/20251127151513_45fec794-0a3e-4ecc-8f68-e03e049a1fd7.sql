-- Add last_updated field to currencies table
ALTER TABLE currencies ADD COLUMN IF NOT EXISTS last_updated timestamp with time zone DEFAULT now();