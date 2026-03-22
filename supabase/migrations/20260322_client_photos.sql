-- =============================================================================
-- Client Photos — table, enum, storage bucket, and RLS policies
-- =============================================================================
-- Per-booking photo gallery for before/after/reference images.
-- Photos are uploaded by staff via /api/upload-client-photo and stored in
-- Supabase Storage bucket `client-photos` at path {profile_id}/{booking_id}/{filename}.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE photo_type AS ENUM ('before', 'after', 'reference');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_photos (
  id            serial       PRIMARY KEY,
  booking_id    integer      NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  profile_id    uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploaded_by   uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  photo_type    photo_type   NOT NULL,
  storage_path  text         NOT NULL,
  notes         text,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_photos_booking_idx     ON public.client_photos (booking_id);
CREATE INDEX IF NOT EXISTS client_photos_profile_idx     ON public.client_photos (profile_id);
CREATE INDEX IF NOT EXISTS client_photos_uploaded_by_idx ON public.client_photos (uploaded_by);

-- ---------------------------------------------------------------------------
-- 3. Storage bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos',
  'client-photos',
  false,  -- private bucket — access via signed URLs
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 4. Storage RLS — client-photos bucket
-- ---------------------------------------------------------------------------

-- Clients read their own photos (path: {profile_id}/...)
CREATE POLICY "client-photos: owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff can read all client photos
CREATE POLICY "client-photos: staff read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- Staff can upload client photos
CREATE POLICY "client-photos: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- Staff can update metadata
CREATE POLICY "client-photos: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- Staff can delete client photos
CREATE POLICY "client-photos: staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- ---------------------------------------------------------------------------
-- 5. Database RLS — client_photos table
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_photos ENABLE ROW LEVEL SECURITY;

-- Clients read their own photos
CREATE POLICY "client_photos: owner read"
  ON public.client_photos FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
  );

-- Staff read all photos
CREATE POLICY "client_photos: staff read"
  ON public.client_photos FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'assistant')
  );

-- Staff insert photos for bookings they can access
CREATE POLICY "client_photos: staff insert"
  ON public.client_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('admin', 'assistant')
  );

-- Staff update photos
CREATE POLICY "client_photos: staff update"
  ON public.client_photos FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'assistant')
  );

-- Staff delete photos
CREATE POLICY "client_photos: staff delete"
  ON public.client_photos FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'assistant')
  );
