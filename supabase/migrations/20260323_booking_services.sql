-- Multi-service bookings: junction table linking bookings to multiple services.
-- Each row snapshots the service price, duration, and deposit at booking time.
-- The row with order_index = 0 is the primary service (matches bookings.service_id).

CREATE TABLE IF NOT EXISTS public.booking_services (
  id              serial PRIMARY KEY,
  booking_id      integer NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id      integer NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  order_index     smallint NOT NULL DEFAULT 0,
  price_in_cents  integer NOT NULL,
  duration_minutes integer NOT NULL,
  deposit_in_cents integer NOT NULL DEFAULT 0,
  UNIQUE(booking_id, service_id)
);

CREATE INDEX IF NOT EXISTS booking_services_booking_idx ON public.booking_services (booking_id);
CREATE INDEX IF NOT EXISTS booking_services_service_idx ON public.booking_services (service_id);

-- Backfill: create one booking_services row per existing booking.
-- Uses the booking's snapshotted price/duration and the service's deposit amount.
INSERT INTO public.booking_services (booking_id, service_id, order_index, price_in_cents, duration_minutes, deposit_in_cents)
SELECT
  b.id,
  b.service_id,
  0,
  b.total_in_cents,
  b.duration_minutes,
  COALESCE(s.deposit_in_cents, 0)
FROM public.bookings b
JOIN public.services s ON s.id = b.service_id
WHERE b.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- RLS policies (mirrors booking_add_ons pattern)
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_services: client read own"
  ON public.booking_services FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'client'
    AND booking_id IN (SELECT id FROM public.bookings WHERE client_id = auth.uid())
  );

CREATE POLICY "booking_services: staff read all"
  ON public.booking_services FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "booking_services: staff write"
  ON public.booking_services FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));
