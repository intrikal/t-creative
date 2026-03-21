-- =============================================================================
-- CCPA Data Deletion — Audit Log RLS
-- =============================================================================
-- Adds Row-Level Security to the audit_log table so that:
--   1. Clients can only read their own CCPA deletion request entries
--      (actor_id = auth.uid() AND entity_type = 'ccpa_deletion_request')
--   2. Admin/assistant staff can read all audit_log entries
--   3. Only service-role (server actions) can INSERT — no direct client writes
--
-- The audit_log is append-only: no UPDATE or DELETE policies are created.
-- =============================================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Staff (admin/assistant) can read all audit log entries
CREATE POLICY "audit_log: staff read all"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'assistant')
  );

-- Clients can read only their own CCPA deletion request entries
CREATE POLICY "audit_log: client read own ccpa"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    AND entity_type = 'ccpa_deletion_request'
  );

-- Only service-role (server actions via Drizzle) can insert audit entries.
-- Authenticated users cannot insert directly.
CREATE POLICY "audit_log: service role insert"
  ON public.audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);
