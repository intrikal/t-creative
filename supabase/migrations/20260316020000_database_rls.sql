-- =============================================================================
-- Database Row-Level Security (RLS) Policies
-- =============================================================================
-- Roles: admin | assistant | client
-- Helper: public.get_user_role() — defined in 20260316_storage_buckets_rls.sql
--
-- Pattern used throughout:
--   • "admin/assistant" tables  → staff can manage; clients see their own rows
--   • "public read" tables      → anyone can SELECT; only admin can mutate
--   • "private" tables          → no direct client access (service-role only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users read their own profile; admin/assistant read all
CREATE POLICY "profiles: self or staff read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() IN ('admin', 'assistant')
  );

-- Users update their own profile; admin updates any
CREATE POLICY "profiles: self or admin update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- Only admin creates / deletes profiles (normally handled by auth trigger)
CREATE POLICY "profiles: admin insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "profiles: admin delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- ASSISTANT_PROFILES
-- ---------------------------------------------------------------------------
ALTER TABLE public.assistant_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (shown on booking page)
CREATE POLICY "assistant_profiles: authenticated read"
  ON public.assistant_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Assistant manages their own extended profile; admin manages all
CREATE POLICY "assistant_profiles: self or admin write"
  ON public.assistant_profiles FOR ALL
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.get_user_role() = 'admin'
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- MEDIA_ITEMS
-- ---------------------------------------------------------------------------
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

-- Public: anyone can see published items
CREATE POLICY "media_items: public read published"
  ON public.media_items FOR SELECT
  USING (is_published = true);

-- Authenticated clients see their own tagged items (including unpublished)
CREATE POLICY "media_items: client read own"
  ON public.media_items FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

-- Admin/assistant see everything
CREATE POLICY "media_items: staff read all"
  ON public.media_items FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Admin/assistant insert and update
CREATE POLICY "media_items: staff insert"
  ON public.media_items FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "media_items: staff update"
  ON public.media_items FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Client can update consent on their own tagged photo (for grantPhotoConsent flow)
CREATE POLICY "media_items: client consent update"
  ON public.media_items FOR UPDATE
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "media_items: staff delete"
  ON public.media_items FOR DELETE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- SERVICES & SERVICE_ADD_ONS  (public catalogue, admin manages)
-- ---------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services: public read active"
  ON public.services FOR SELECT
  USING (is_active = true);

CREATE POLICY "services: admin read all"
  ON public.services FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "services: admin write"
  ON public.services FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.service_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_add_ons: public read active"
  ON public.service_add_ons FOR SELECT
  USING (is_active = true);

CREATE POLICY "services_add_ons: admin read all"
  ON public.service_add_ons FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "service_add_ons: admin write"
  ON public.service_add_ons FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- PRODUCTS, PRODUCT_IMAGES, PRODUCT_INQUIRIES
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products: public read published"
  ON public.products FOR SELECT
  USING (is_published = true);

CREATE POLICY "products: admin read all"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "products: admin write"
  ON public.products FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images: public read"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "product_images: admin write"
  ON public.product_images FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.product_inquiries ENABLE ROW LEVEL SECURITY;

-- Logged-in clients see their own inquiries
CREATE POLICY "product_inquiries: client read own"
  ON public.product_inquiries FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "product_inquiries: staff read all"
  ON public.product_inquiries FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Anyone (including anon) can submit a product inquiry
CREATE POLICY "product_inquiries: public insert"
  ON public.product_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "product_inquiries: staff update"
  ON public.product_inquiries FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "product_inquiries: admin delete"
  ON public.product_inquiries FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- BOOKINGS & BOOKING_ADD_ONS
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings: client read own"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "bookings: staff read all"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Clients can create their own bookings; staff can create for any client
CREATE POLICY "bookings: client insert own"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "bookings: staff insert"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- Staff manage bookings; clients can cancel their own (app validates status)
CREATE POLICY "bookings: client update own"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "bookings: staff update"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "bookings: admin delete"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

ALTER TABLE public.booking_add_ons ENABLE ROW LEVEL SECURITY;

-- Clients can see add-ons for their own bookings
CREATE POLICY "booking_add_ons: client read own"
  ON public.booking_add_ons FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'client'
    AND booking_id IN (
      SELECT id FROM public.bookings WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "booking_add_ons: staff read all"
  ON public.booking_add_ons FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "booking_add_ons: staff write"
  ON public.booking_add_ons FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- BOOKING_RULES  (public read for booking form; admin writes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.booking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_rules: public read"
  ON public.booking_rules FOR SELECT
  USING (true);

CREATE POLICY "booking_rules: admin write"
  ON public.booking_rules FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: client read own"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "payments: staff read all"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "payments: staff write"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: client read own"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "orders: staff read all"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "orders: staff write"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- INQUIRIES  (contact form — public insert; staff manages)
-- ---------------------------------------------------------------------------
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiries: client read own"
  ON public.inquiries FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "inquiries: staff read all"
  ON public.inquiries FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Public inquiry form (no auth required)
CREATE POLICY "inquiries: public insert"
  ON public.inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "inquiries: staff update"
  ON public.inquiries FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "inquiries: admin delete"
  ON public.inquiries FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can see approved, featured reviews
CREATE POLICY "reviews: public read approved"
  ON public.reviews FOR SELECT
  USING (status = 'approved');

-- Clients see their own (including pending)
CREATE POLICY "reviews: client read own"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "reviews: staff read all"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Clients submit their own review
CREATE POLICY "reviews: client insert own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

-- Clients edit their pending review; staff moderate
CREATE POLICY "reviews: client update own pending"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
    AND status = 'pending'
  );

CREATE POLICY "reviews: staff update"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "reviews: admin delete"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- THREADS & MESSAGES
-- ---------------------------------------------------------------------------
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads: client read own"
  ON public.threads FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "threads: staff read all"
  ON public.threads FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "threads: client insert own"
  ON public.threads FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "threads: staff insert"
  ON public.threads FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "threads: staff update"
  ON public.threads FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "threads: admin delete"
  ON public.threads FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Clients read messages in their own threads
CREATE POLICY "messages: client read own thread"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'client'
    AND thread_id IN (
      SELECT id FROM public.threads WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "messages: staff read all"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

-- Clients send messages to their own threads
CREATE POLICY "messages: client insert own thread"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() = 'client'
    AND sender_id = auth.uid()
    AND thread_id IN (
      SELECT id FROM public.threads WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "messages: staff insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- Clients mark their received messages as read
CREATE POLICY "messages: client update read status"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'client'
    AND recipient_id = auth.uid()
  );

CREATE POLICY "messages: staff update"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "messages: admin delete"
  ON public.messages FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- TRAINING: programs, modules, lessons, sessions (public curriculum)
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_programs: public read active"
  ON public.training_programs FOR SELECT
  USING (is_active = true);

CREATE POLICY "training_programs: admin read all"
  ON public.training_programs FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "training_programs: admin write"
  ON public.training_programs FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_modules: public read"
  ON public.training_modules FOR SELECT
  USING (true);

CREATE POLICY "training_modules: admin write"
  ON public.training_modules FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_lessons: public read"
  ON public.training_lessons FOR SELECT
  USING (true);

CREATE POLICY "training_lessons: admin write"
  ON public.training_lessons FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_sessions: public read"
  ON public.training_sessions FOR SELECT
  USING (true);

CREATE POLICY "training_sessions: admin write"
  ON public.training_sessions FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- ENROLLMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments: client read own"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "enrollments: staff read all"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "enrollments: staff write"
  ON public.enrollments FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- SESSION_ATTENDANCE
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- Clients can see their own attendance
CREATE POLICY "session_attendance: client read own"
  ON public.session_attendance FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'client'
    AND enrollment_id IN (
      SELECT id FROM public.enrollments WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "session_attendance: staff read all"
  ON public.session_attendance FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "session_attendance: staff write"
  ON public.session_attendance FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- CERTIFICATES
-- ---------------------------------------------------------------------------
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificates: client read own"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "certificates: admin read all"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "certificates: admin write"
  ON public.certificates FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- POLICIES  (aftercare/studio policies — public read)
-- ---------------------------------------------------------------------------
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies: public read published"
  ON public.policies FOR SELECT
  USING (is_published = true);

CREATE POLICY "policies: admin read all"
  ON public.policies FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "policies: admin write"
  ON public.policies FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events are internal B2B; only staff access
CREATE POLICY "events: staff read"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "events: staff write"
  ON public.events FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- SHIFTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Assistants see their own shifts; admin sees all
CREATE POLICY "shifts: assistant read own"
  ON public.shifts FOR SELECT
  TO authenticated
  USING (
    assistant_id = auth.uid()
    AND public.get_user_role() = 'assistant'
  );

CREATE POLICY "shifts: admin read all"
  ON public.shifts FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "shifts: admin write"
  ON public.shifts FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- BUSINESS_HOURS & TIME_OFF  (public read for booking availability)
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_hours: public read"
  ON public.business_hours FOR SELECT
  USING (true);

CREATE POLICY "business_hours: staff write"
  ON public.business_hours FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_off: public read"
  ON public.time_off FOR SELECT
  USING (true);

CREATE POLICY "time_off: staff write"
  ON public.time_off FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));

-- ---------------------------------------------------------------------------
-- SETTINGS
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: staff read"
  ON public.settings FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "settings: admin write"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- QUICK_REPLIES
-- ---------------------------------------------------------------------------
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quick_replies: staff read"
  ON public.quick_replies FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "quick_replies: admin write"
  ON public.quick_replies FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- WISHLIST_ITEMS
-- ---------------------------------------------------------------------------
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_items: client read own"
  ON public.wishlist_items FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "wishlist_items: client insert own"
  ON public.wishlist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

CREATE POLICY "wishlist_items: client delete own"
  ON public.wishlist_items FOR DELETE
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.get_user_role() = 'client'
  );

-- ---------------------------------------------------------------------------
-- SYNC_LOG & WEBHOOK_EVENTS  (internal integration tables — admin only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log: admin read"
  ON public.sync_log FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "sync_log: admin write"
  ON public.sync_log FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events: admin read"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "webhook_events: admin write"
  ON public.webhook_events FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
