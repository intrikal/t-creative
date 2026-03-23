-- Email sequences: automated lifecycle drip campaigns.

CREATE TYPE sequence_trigger AS ENUM (
  'first_booking_completed',
  'no_visit_30_days',
  'no_visit_60_days',
  'membership_cancelled',
  'new_client_signup'
);

-- Reuse a distinct name to avoid collision with training enrollment_status
CREATE TYPE seq_enrollment_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS public.email_sequences (
  id            serial PRIMARY KEY,
  name          varchar(200) NOT NULL,
  trigger_event sequence_trigger NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_sequences_trigger_idx ON public.email_sequences (trigger_event);
CREATE INDEX IF NOT EXISTS email_sequences_active_idx ON public.email_sequences (is_active);

CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
  id            serial PRIMARY KEY,
  sequence_id   integer NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_order    integer NOT NULL,
  delay_days    integer NOT NULL DEFAULT 0,
  subject       varchar(500) NOT NULL,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS email_seq_steps_sequence_idx ON public.email_sequence_steps (sequence_id);

CREATE TABLE IF NOT EXISTS public.email_sequence_enrollments (
  id              serial PRIMARY KEY,
  sequence_id     integer NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_step    integer NOT NULL DEFAULT 0,
  status          seq_enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  last_step_sent_at timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz
);

CREATE INDEX IF NOT EXISTS email_seq_enroll_sequence_idx ON public.email_sequence_enrollments (sequence_id);
CREATE INDEX IF NOT EXISTS email_seq_enroll_profile_idx ON public.email_sequence_enrollments (profile_id);
CREATE INDEX IF NOT EXISTS email_seq_enroll_status_idx ON public.email_sequence_enrollments (status);

-- Deduplication: one active enrollment per sequence per client
CREATE UNIQUE INDEX IF NOT EXISTS email_seq_enroll_active_unq
  ON public.email_sequence_enrollments (sequence_id, profile_id)
  WHERE status = 'active';

-- RLS: admin only
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_sequences: admin read" ON public.email_sequences FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');
CREATE POLICY "email_sequences: admin write" ON public.email_sequences FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "email_sequence_steps: admin read" ON public.email_sequence_steps FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');
CREATE POLICY "email_sequence_steps: admin write" ON public.email_sequence_steps FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "email_sequence_enrollments: admin read" ON public.email_sequence_enrollments FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');
CREATE POLICY "email_sequence_enrollments: admin write" ON public.email_sequence_enrollments FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
