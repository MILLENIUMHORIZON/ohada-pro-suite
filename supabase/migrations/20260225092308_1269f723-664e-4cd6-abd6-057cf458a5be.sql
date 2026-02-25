
-- =============================================
-- PHASE 1: GESTION DE STOCK INDUSTRIEL
-- =============================================

-- 1. Extend product_type enum
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'raw_material';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'semi_finished';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'finished';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'consumable';
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'spare_part';

-- 2. Add industrial columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_location_id uuid REFERENCES public.stock_locations(id),
  ADD COLUMN IF NOT EXISTS main_supplier_id uuid REFERENCES public.partners(id);

-- 3. Create stock_move_type enum
DO $$ BEGIN
  CREATE TYPE public.stock_move_type AS ENUM (
    'supplier_in','production_out','production_in','transfer',
    'adjustment','production_return','scrap','customer_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add columns to stock_moves
ALTER TABLE public.stock_moves
  ADD COLUMN IF NOT EXISTS move_type public.stock_move_type DEFAULT 'supplier_in',
  ADD COLUMN IF NOT EXISTS responsible_id uuid,
  ADD COLUMN IF NOT EXISTS notes text;

-- 5. Fix stock_quants: add missing columns
ALTER TABLE public.stock_quants
  ADD COLUMN IF NOT EXISTS reserved_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'CDF',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add company_id to unique constraint if not already
DO $$ BEGIN
  ALTER TABLE public.stock_quants DROP CONSTRAINT IF EXISTS stock_quants_product_id_location_id_key;
  ALTER TABLE public.stock_quants ADD CONSTRAINT stock_quants_product_location_company_key 
    UNIQUE (product_id, location_id, company_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Create stock_valuation_accounts table
CREATE TABLE IF NOT EXISTS public.stock_valuation_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  product_type public.product_type NOT NULL,
  stock_account_id uuid REFERENCES public.accounts(id),
  variation_account_id uuid REFERENCES public.accounts(id),
  expense_account_id uuid REFERENCES public.accounts(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, product_type)
);

ALTER TABLE public.stock_valuation_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own company stock_valuation_accounts"
    ON public.stock_valuation_accounts FOR SELECT
    USING (company_id = get_user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage own company stock_valuation_accounts"
    ON public.stock_valuation_accounts FOR ALL
    USING (company_id = get_user_company_id())
    WITH CHECK (company_id = get_user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Triggers for auto-updating stock_quants
CREATE OR REPLACE FUNCTION public.process_stock_move_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.state = 'done' AND (OLD.state IS NULL OR OLD.state != 'done') THEN
    -- Decrease at source if internal
    IF EXISTS (SELECT 1 FROM stock_locations WHERE id = NEW.from_location_id AND type IN ('internal', 'transit')) THEN
      INSERT INTO stock_quants (product_id, location_id, company_id, qty_on_hand, cost)
      VALUES (NEW.product_id, NEW.from_location_id, NEW.company_id, -NEW.qty, COALESCE(NEW.cost, 0))
      ON CONFLICT (product_id, location_id, company_id)
      DO UPDATE SET 
        qty_on_hand = stock_quants.qty_on_hand - NEW.qty,
        updated_at = now();
    END IF;
    
    -- Increase at destination if internal
    IF EXISTS (SELECT 1 FROM stock_locations WHERE id = NEW.to_location_id AND type IN ('internal', 'transit')) THEN
      INSERT INTO stock_quants (product_id, location_id, company_id, qty_on_hand, cost)
      VALUES (NEW.product_id, NEW.to_location_id, NEW.company_id, NEW.qty, COALESCE(NEW.cost, 0))
      ON CONFLICT (product_id, location_id, company_id)
      DO UPDATE SET 
        qty_on_hand = stock_quants.qty_on_hand + NEW.qty,
        cost = CASE WHEN stock_quants.qty_on_hand + NEW.qty > 0 
          THEN ((stock_quants.cost * GREATEST(stock_quants.qty_on_hand, 0)) + (COALESCE(NEW.cost, 0) * NEW.qty)) / (stock_quants.qty_on_hand + NEW.qty)
          ELSE COALESCE(NEW.cost, 0) END,
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_stock_move ON public.stock_moves;
CREATE TRIGGER trg_process_stock_move
  AFTER UPDATE ON public.stock_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.process_stock_move_validation();

CREATE OR REPLACE FUNCTION public.process_stock_move_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.state = 'done' THEN
    IF EXISTS (SELECT 1 FROM stock_locations WHERE id = NEW.from_location_id AND type IN ('internal', 'transit')) THEN
      INSERT INTO stock_quants (product_id, location_id, company_id, qty_on_hand, cost)
      VALUES (NEW.product_id, NEW.from_location_id, NEW.company_id, -NEW.qty, COALESCE(NEW.cost, 0))
      ON CONFLICT (product_id, location_id, company_id)
      DO UPDATE SET qty_on_hand = stock_quants.qty_on_hand - NEW.qty, updated_at = now();
    END IF;
    
    IF EXISTS (SELECT 1 FROM stock_locations WHERE id = NEW.to_location_id AND type IN ('internal', 'transit')) THEN
      INSERT INTO stock_quants (product_id, location_id, company_id, qty_on_hand, cost)
      VALUES (NEW.product_id, NEW.to_location_id, NEW.company_id, NEW.qty, COALESCE(NEW.cost, 0))
      ON CONFLICT (product_id, location_id, company_id)
      DO UPDATE SET 
        qty_on_hand = stock_quants.qty_on_hand + NEW.qty,
        cost = CASE WHEN stock_quants.qty_on_hand + NEW.qty > 0 
          THEN ((stock_quants.cost * GREATEST(stock_quants.qty_on_hand, 0)) + (COALESCE(NEW.cost, 0) * NEW.qty)) / (stock_quants.qty_on_hand + NEW.qty)
          ELSE COALESCE(NEW.cost, 0) END,
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_stock_move_insert ON public.stock_moves;
CREATE TRIGGER trg_process_stock_move_insert
  AFTER INSERT ON public.stock_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.process_stock_move_insert();

-- 8. Helper functions
CREATE OR REPLACE FUNCTION public.get_product_stock(p_product_id uuid, p_company_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_qty numeric;
BEGIN
  SELECT COALESCE(SUM(sq.qty_on_hand), 0) INTO v_qty
  FROM stock_quants sq
  JOIN stock_locations sl ON sl.id = sq.location_id
  WHERE sq.product_id = p_product_id AND sq.company_id = p_company_id AND sl.type = 'internal';
  RETURN v_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_available_stock(p_product_id uuid, p_company_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_qty numeric;
BEGIN
  SELECT COALESCE(SUM(sq.qty_on_hand - sq.reserved_qty), 0) INTO v_qty
  FROM stock_quants sq
  JOIN stock_locations sl ON sl.id = sq.location_id
  WHERE sq.product_id = p_product_id AND sq.company_id = p_company_id AND sl.type = 'internal';
  RETURN v_qty;
END;
$$;

-- 9. Add STK sequence
INSERT INTO public.sequences (company_id, code, prefix, padding, current)
SELECT id, 'STK', 'MVT-', 5, 0 FROM public.companies
ON CONFLICT (company_id, code) DO NOTHING;

-- 10. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_quants;
