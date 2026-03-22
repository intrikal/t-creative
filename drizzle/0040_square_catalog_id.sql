-- Migration 0040: Add square_catalog_id to services
--
-- Stores the Square Catalog Object ID for each service so upsertCatalogItem()
-- can update existing items instead of creating duplicates on re-push.
-- Products already have this column (see 0000 baseline); this brings services
-- into parity.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS square_catalog_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS services_square_id_idx
  ON services (square_catalog_id)
  WHERE square_catalog_id IS NOT NULL;
