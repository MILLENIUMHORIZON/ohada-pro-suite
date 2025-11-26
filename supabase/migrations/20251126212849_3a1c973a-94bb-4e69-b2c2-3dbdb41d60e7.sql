-- Ajouter le type 'tax' à l'enum product_type
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'tax';

-- Ajouter une colonne pour stocker le code de type de produit (BIE, SER, TAX)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type_code TEXT;