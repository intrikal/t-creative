-- Inventory management: SKU, cost tracking, adjustment audit log, and stock constraints.

-- Add new columns to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS sku varchar(100) UNIQUE,
ADD COLUMN IF NOT EXISTS cost_in_cents integer,
ADD COLUMN IF NOT EXISTS reorder_quantity integer NOT NULL DEFAULT 10;

CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products (sku);

-- CHECK constraint: stock can never go negative
ALTER TABLE public.products
ADD CONSTRAINT stock_count_nonneg CHECK (stock_count >= 0);

-- Inventory adjustment reason enum
DO $$ BEGIN
  CREATE TYPE inventory_adjustment_reason AS ENUM ('sale', 'restock', 'damage', 'correction', 'return');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Inventory adjustments audit log
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id              serial PRIMARY KEY,
  product_id      integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_delta   integer NOT NULL,
  quantity_after   integer NOT NULL,
  reason          inventory_adjustment_reason NOT NULL,
  notes           text,
  actor_id        varchar(100),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inv_adj_product_idx ON public.inventory_adjustments (product_id);
CREATE INDEX IF NOT EXISTS inv_adj_created_idx ON public.inventory_adjustments (created_at);
CREATE INDEX IF NOT EXISTS inv_adj_reason_idx ON public.inventory_adjustments (reason);

-- RLS: admin only for inventory adjustments
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_adjustments: admin read"
  ON public.inventory_adjustments FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "inventory_adjustments: admin write"
  ON public.inventory_adjustments FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
