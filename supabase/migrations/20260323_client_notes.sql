-- Client notes: communication history and internal notes per client.
-- Staff-only — clients cannot read notes about themselves.

CREATE TYPE client_note_type AS ENUM ('note', 'call', 'email', 'sms', 'in_person');

CREATE TABLE IF NOT EXISTS public.client_notes (
  id            serial PRIMARY KEY,
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  type          client_note_type NOT NULL DEFAULT 'note',
  content       text NOT NULL,
  is_pinned     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_notes_profile_idx ON public.client_notes (profile_id);
CREATE INDEX IF NOT EXISTS client_notes_author_idx ON public.client_notes (author_id);
CREATE INDEX IF NOT EXISTS client_notes_type_idx ON public.client_notes (type);
CREATE INDEX IF NOT EXISTS client_notes_pinned_idx ON public.client_notes (profile_id, is_pinned);
CREATE INDEX IF NOT EXISTS client_notes_created_idx ON public.client_notes (profile_id, created_at);

-- RLS: admin and staff can read/write. Clients CANNOT see notes.
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_notes: staff read all"
  ON public.client_notes FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'));

CREATE POLICY "client_notes: staff write"
  ON public.client_notes FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'assistant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'assistant'));
