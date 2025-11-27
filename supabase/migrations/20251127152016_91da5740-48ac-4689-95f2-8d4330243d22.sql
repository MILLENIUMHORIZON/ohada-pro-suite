-- Add invoice_reference_type column to invoices table for credit note types
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_reference_type text;