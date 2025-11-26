-- Supprimer l'ancienne contrainte unique sur le code seul
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_code_key;

-- Ajouter une nouvelle contrainte unique sur (company_id, code)
-- Cela permet à chaque company d'avoir son propre plan comptable avec les mêmes codes
ALTER TABLE accounts ADD CONSTRAINT accounts_company_code_unique UNIQUE (company_id, code);