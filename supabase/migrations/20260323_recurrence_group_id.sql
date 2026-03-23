-- Add recurrence_group_id column to bookings for batch-created recurring series.
-- All bookings in a series share the same UUID, enabling efficient bulk operations.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

CREATE INDEX IF NOT EXISTS bookings_recurrence_group_idx
ON public.bookings (recurrence_group_id);

-- Backfill: assign a shared group ID to existing recurring series.
-- Each series root (parentBookingId IS NULL, recurrenceRule IS NOT NULL)
-- gets a new UUID, propagated to all children.
DO $$
DECLARE
  root RECORD;
  gid  uuid;
BEGIN
  FOR root IN
    SELECT id FROM public.bookings
    WHERE recurrence_rule IS NOT NULL
      AND recurrence_rule != ''
      AND parent_booking_id IS NULL
      AND deleted_at IS NULL
  LOOP
    gid := gen_random_uuid();
    UPDATE public.bookings
    SET recurrence_group_id = gid
    WHERE id = root.id
       OR parent_booking_id = root.id;
  END LOOP;
END $$;
