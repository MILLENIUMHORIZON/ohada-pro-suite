-- Step 1: Convert type column to text temporarily
ALTER TABLE partners 
  ALTER COLUMN type TYPE text;

-- Step 2: Drop and recreate the enum with new values
DROP TYPE IF EXISTS partner_type CASCADE;
CREATE TYPE partner_type AS ENUM ('PP', 'PM', 'PC', 'PL', 'AO');

-- Step 3: Convert column back to enum with default
ALTER TABLE partners 
  ALTER COLUMN type TYPE partner_type USING 'PP'::partner_type,
  ALTER COLUMN type SET DEFAULT 'PP'::partner_type;