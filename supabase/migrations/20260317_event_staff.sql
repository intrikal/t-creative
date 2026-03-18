-- Multi-staff assignment for events.
-- Join table allowing multiple staff members per event with role + notes.

CREATE TABLE IF NOT EXISTS event_staff (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_staff_event_idx ON event_staff(event_id);
CREATE INDEX IF NOT EXISTS event_staff_staff_idx ON event_staff(staff_id);
