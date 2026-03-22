-- Multi-location support: locations table + location_id FKs on scoped tables.
-- Seeds a default location from current settings so all existing data is tagged.

-- 1. Create locations table
CREATE TABLE "locations" (
  "id" serial PRIMARY KEY,
  "name" varchar(200) NOT NULL,
  "address" text,
  "city" varchar(200),
  "timezone" varchar(100) NOT NULL DEFAULT 'America/Los_Angeles',
  "phone" varchar(50),
  "email" varchar(200),
  "square_location_id" varchar(100),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "locations_active_idx" ON "locations" ("is_active");
CREATE INDEX "locations_square_idx" ON "locations" ("square_location_id");

-- 2. Seed default location from current business profile settings
INSERT INTO "locations" ("name", "city", "timezone", "phone", "email")
SELECT
  coalesce(s1.value #>> '{}', 'T Creative Studio'),
  coalesce(s2.value #>> '{}', 'San Jose, CA'),
  coalesce(s3.value #>> '{}', 'America/Los_Angeles'),
  coalesce(s4.value #>> '{}', ''),
  coalesce(s5.value #>> '{}', '')
FROM
  (SELECT value FROM settings WHERE key = 'businessName' LIMIT 1) s1,
  (SELECT value FROM settings WHERE key = 'location' LIMIT 1) s2,
  (SELECT value FROM settings WHERE key = 'timezone' LIMIT 1) s3,
  (SELECT value FROM settings WHERE key = 'phone' LIMIT 1) s4,
  (SELECT value FROM settings WHERE key = 'email' LIMIT 1) s5;

-- Fallback: if no settings exist, insert a default
INSERT INTO "locations" ("name", "city", "timezone")
SELECT 'T Creative Studio', 'San Jose, CA', 'America/Los_Angeles'
WHERE NOT EXISTS (SELECT 1 FROM "locations");

-- 3. Add location_id columns
ALTER TABLE "bookings" ADD COLUMN "location_id" integer REFERENCES "locations"("id") ON DELETE SET NULL;
ALTER TABLE "business_hours" ADD COLUMN "location_id" integer REFERENCES "locations"("id") ON DELETE CASCADE;
ALTER TABLE "time_off" ADD COLUMN "location_id" integer REFERENCES "locations"("id") ON DELETE CASCADE;
ALTER TABLE "booking_rules" ADD COLUMN "location_id" integer REFERENCES "locations"("id") ON DELETE CASCADE;
ALTER TABLE "shifts" ADD COLUMN "location_id" integer REFERENCES "locations"("id") ON DELETE SET NULL;

-- 4. Backfill all existing rows with the default location (id = 1)
UPDATE "bookings" SET "location_id" = 1 WHERE "location_id" IS NULL;
UPDATE "business_hours" SET "location_id" = 1 WHERE "location_id" IS NULL;
UPDATE "time_off" SET "location_id" = 1 WHERE "location_id" IS NULL;
UPDATE "booking_rules" SET "location_id" = 1 WHERE "location_id" IS NULL;
UPDATE "shifts" SET "location_id" = 1 WHERE "location_id" IS NULL;

-- 5. Add indexes on the new columns
CREATE INDEX "bookings_location_idx" ON "bookings" ("location_id");
CREATE INDEX "business_hours_location_idx" ON "business_hours" ("location_id");
CREATE INDEX "time_off_location_idx" ON "time_off" ("location_id");
CREATE INDEX "shifts_location_idx" ON "shifts" ("location_id");
