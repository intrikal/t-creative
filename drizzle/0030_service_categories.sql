-- Service categories lookup table
CREATE TABLE IF NOT EXISTS "service_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);

-- Seed with the 6 existing categories
INSERT INTO "service_categories" ("name", "slug", "display_order", "is_active") VALUES
  ('Lash Extensions', 'lash', 1, true),
  ('Permanent Jewelry', 'jewelry', 2, true),
  ('Crochet', 'crochet', 3, true),
  ('Consulting', 'consulting', 4, true),
  ('3D Printing', '3d_printing', 5, true),
  ('Aesthetics', 'aesthetics', 6, true)
ON CONFLICT ("slug") DO NOTHING;
