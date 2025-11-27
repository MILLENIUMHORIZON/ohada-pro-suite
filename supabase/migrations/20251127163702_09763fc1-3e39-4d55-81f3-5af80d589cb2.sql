-- Add dgi_qrcode column to store the QR code returned by DGI
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dgi_qrcode TEXT;