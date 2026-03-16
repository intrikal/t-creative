-- =============================================================================
-- Storage Buckets + RLS Policies
-- =============================================================================
-- Buckets:
--   media             – public  – portfolio images/videos (admin/assistant upload)
--   avatars           – public  – user profile pictures (owner upload)
--   booking-references– public  – guest reference photos (service-role upload)
--   product-images    – public  – product catalog images (admin upload)
--   certificates      – private – training certificate PDFs (admin upload, owner read)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'media',
    'media',
    true,
    104857600, -- 100 MB (videos)
    ARRAY[
      'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
      'video/mp4','video/webm','video/quicktime'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg','image/png','image/webp','image/gif']
  ),
  (
    'booking-references',
    'booking-references',
    true,
    8388608, -- 8 MB (matches app validation)
    ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
  ),
  (
    'product-images',
    'product-images',
    true,
    10485760, -- 10 MB
    ARRAY['image/jpeg','image/png','image/webp','image/gif']
  ),
  (
    'certificates',
    'certificates',
    false, -- private bucket
    10485760, -- 10 MB
    ARRAY['application/pdf']
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit  = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Helper: get current user's role (security definer avoids infinite RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 3. Storage RLS — enable for storage.objects (Supabase enables this by default,
--    but explicit is safer after bucket creation)
-- ---------------------------------------------------------------------------

-- ===== MEDIA BUCKET =====

-- Anyone can view media files (public portfolio)
CREATE POLICY "media: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Admin/assistant can upload
CREATE POLICY "media: staff insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- Admin/assistant can update metadata
CREATE POLICY "media: staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- Admin/assistant can delete
CREATE POLICY "media: staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- ===== AVATARS BUCKET =====

-- Anyone can view avatars (profile pictures shown publicly)
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users upload to their own folder: avatars/{user_id}/...
CREATE POLICY "avatars: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can overwrite their own avatar
CREATE POLICY "avatars: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar; admin can delete any
CREATE POLICY "avatars: owner or admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_role() = 'admin'
    )
  );

-- ===== BOOKING-REFERENCES BUCKET =====
-- Uploads go through the /api/book/upload-reference route using the
-- service-role key, which bypasses RLS. Only staff need read access here.

CREATE POLICY "booking-references: staff read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'booking-references'
    AND public.get_user_role() IN ('admin', 'assistant')
  );

-- Service role handles inserts (bypasses RLS); block direct anon uploads
-- (no INSERT policy = anon/authenticated users cannot upload directly)

-- Admin can clean up old reference photos
CREATE POLICY "booking-references: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'booking-references'
    AND public.get_user_role() = 'admin'
  );

-- ===== PRODUCT-IMAGES BUCKET =====

CREATE POLICY "product-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "product-images: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "product-images: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "product-images: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.get_user_role() = 'admin'
  );

-- ===== CERTIFICATES BUCKET (private) =====

-- Admin can read all certificates
CREATE POLICY "certificates: admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND public.get_user_role() = 'admin'
  );

-- Certificate owner can download their own PDF.
-- Path convention: certificates/{client_id}/...
CREATE POLICY "certificates: owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "certificates: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "certificates: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "certificates: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND public.get_user_role() = 'admin'
  );
