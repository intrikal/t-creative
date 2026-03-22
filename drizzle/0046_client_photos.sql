-- Client photos table for per-booking before/after/reference images.

CREATE TYPE "photo_type" AS ENUM ('before', 'after', 'reference');

CREATE TABLE "client_photos" (
  "id" serial PRIMARY KEY,
  "booking_id" integer NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "uploaded_by" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE SET NULL,
  "photo_type" "photo_type" NOT NULL,
  "storage_path" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "client_photos_booking_idx" ON "client_photos" ("booking_id");
CREATE INDEX "client_photos_profile_idx" ON "client_photos" ("profile_id");
CREATE INDEX "client_photos_uploaded_by_idx" ON "client_photos" ("uploaded_by");

-- RLS: clients read own photos, staff insert for own bookings
ALTER TABLE "client_photos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_photos: client reads own"
  ON "client_photos" FOR SELECT
  TO authenticated
  USING ("profile_id" = auth.uid());

CREATE POLICY "client_photos: staff reads all"
  ON "client_photos" FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "client_photos: staff inserts"
  ON "client_photos" FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "client_photos: staff deletes"
  ON "client_photos" FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Storage bucket (create via Supabase Dashboard or API, not SQL)
-- Bucket: client-photos, public: false (signed URLs for privacy)
-- Storage RLS policies:
INSERT INTO storage.buckets (id, name, public) VALUES ('client-photos', 'client-photos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client-photos: client reads own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "client-photos: staff reads all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

CREATE POLICY "client-photos: staff uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

CREATE POLICY "client-photos: staff deletes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );
