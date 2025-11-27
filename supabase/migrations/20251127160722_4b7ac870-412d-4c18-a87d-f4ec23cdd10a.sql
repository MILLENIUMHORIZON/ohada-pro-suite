-- Add payment_method column to invoices table
ALTER TABLE invoices 
ADD COLUMN payment_method TEXT DEFAULT 'ESPECES';

-- Add check constraint for valid payment methods
ALTER TABLE invoices 
ADD CONSTRAINT payment_method_check 
CHECK (payment_method IN ('ESPECES', 'MOBILEMONEY', 'VIREMENT', 'CARTEBANCAIRE', 'CHEQUES', 'CREDIT', 'AUTRE'));