-- Correct existing user profiles to point to the right company_id
-- Update profiles where company_id doesn't match the one in auth metadata
UPDATE profiles p
SET company_id = (au.raw_user_meta_data->>'company_id')::UUID
FROM auth.users au
WHERE p.user_id = au.id
  AND au.raw_user_meta_data->>'company_id' IS NOT NULL
  AND au.raw_user_meta_data->>'company_id' != ''
  AND p.company_id != (au.raw_user_meta_data->>'company_id')::UUID;