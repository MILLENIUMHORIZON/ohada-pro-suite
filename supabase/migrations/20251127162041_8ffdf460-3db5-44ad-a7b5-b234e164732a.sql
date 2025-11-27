-- Add dgi_uid column to invoices table to store DGI response
ALTER TABLE invoices 
ADD COLUMN dgi_uid TEXT;