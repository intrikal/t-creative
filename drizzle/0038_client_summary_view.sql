-- client_summary view — pre-aggregated stats per client for the admin
-- Clients list page. Replaces three separate subquery joins with a single
-- view scan, and uses actual paid payment amounts (instead of quoted booking
-- prices) for lifetime_spend.
CREATE VIEW client_summary AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  COUNT(DISTINCT b.id)                                              AS total_bookings,
  MAX(b.starts_at)                                                  AS last_visit,
  COALESCE(SUM(pay.amount_in_cents) FILTER (WHERE pay.status = 'paid'), 0) AS lifetime_spend,
  COALESCE(SUM(lt.points), 0)                                       AS loyalty_balance
FROM profiles p
LEFT JOIN bookings b
  ON b.client_id = p.id
 AND b.deleted_at IS NULL
LEFT JOIN payments pay
  ON pay.booking_id = b.id
LEFT JOIN loyalty_transactions lt
  ON lt.profile_id = p.id
WHERE p.role = 'client'
GROUP BY p.id;
