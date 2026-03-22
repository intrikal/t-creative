-- Migration 0039: Materialized views for analytics
--
-- revenue_by_service_daily — paid payment amounts aggregated by service and
-- calendar day. Supports the revenue-by-service chart and any daily time-series
-- breakdowns without hitting the payments + bookings + services join on every
-- page load.
--
-- client_retention_monthly — new vs returning client counts per calendar month.
-- A client is "new" in the month their profile was created; every subsequent
-- month they appear in completed bookings they are "returning".
--
-- Both views are refreshed CONCURRENTLY by the /api/cron/refresh-views cron,
-- which means reads are never blocked during refresh (requires a unique index).

-- ---------------------------------------------------------------------------
-- 1. revenue_by_service_daily
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW revenue_by_service_daily AS
SELECT
  date_trunc('day', pay.paid_at)::date            AS day,
  s.id                                            AS service_id,
  s.name                                          AS service_name,
  s.category                                      AS service_category,
  count(DISTINCT pay.id)                          AS payment_count,
  coalesce(sum(pay.amount_in_cents), 0)           AS revenue_cents,
  coalesce(sum(pay.tip_in_cents), 0)              AS tips_cents,
  count(DISTINCT b.id)                            AS booking_count
FROM payments pay
JOIN bookings b  ON b.id  = pay.booking_id
JOIN services s  ON s.id  = b.service_id
WHERE pay.status = 'paid'
  AND pay.paid_at IS NOT NULL
GROUP BY date_trunc('day', pay.paid_at), s.id, s.name, s.category;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX revenue_by_service_daily_uidx
  ON revenue_by_service_daily (day, service_id);

-- Supporting indexes for common filter patterns
CREATE INDEX revenue_by_service_daily_day_idx
  ON revenue_by_service_daily (day DESC);

CREATE INDEX revenue_by_service_daily_category_idx
  ON revenue_by_service_daily (service_category, day DESC);

-- ---------------------------------------------------------------------------
-- 2. client_retention_monthly
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW client_retention_monthly AS
WITH months AS (
  -- All calendar months that have at least one completed booking
  SELECT DISTINCT date_trunc('month', starts_at)::date AS month
  FROM bookings
  WHERE status = 'completed'
),
new_clients AS (
  -- A client is "new" in the month their profile row was created
  SELECT
    date_trunc('month', created_at)::date AS month,
    count(*)                              AS new_count
  FROM profiles
  WHERE role = 'client'
  GROUP BY date_trunc('month', created_at)
),
active_clients AS (
  -- All clients with at least one completed booking in each month
  SELECT
    date_trunc('month', b.starts_at)::date AS month,
    b.client_id
  FROM bookings b
  WHERE b.status = 'completed'
  GROUP BY date_trunc('month', b.starts_at), b.client_id
),
returning_clients AS (
  -- "Returning" = had a completed booking in a prior month too
  SELECT
    ac.month,
    count(*) AS returning_count
  FROM active_clients ac
  WHERE EXISTS (
    SELECT 1 FROM bookings b2
    WHERE b2.client_id = ac.client_id
      AND b2.status = 'completed'
      AND date_trunc('month', b2.starts_at) < ac.month
  )
  GROUP BY ac.month
)
SELECT
  m.month,
  coalesce(nc.new_count,   0) AS new_clients,
  coalesce(rc.returning_count, 0) AS returning_clients,
  coalesce(nc.new_count, 0) + coalesce(rc.returning_count, 0) AS total_active
FROM months m
LEFT JOIN new_clients       nc ON nc.month = m.month
LEFT JOIN returning_clients rc ON rc.month = m.month
ORDER BY m.month;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX client_retention_monthly_uidx
  ON client_retention_monthly (month);
