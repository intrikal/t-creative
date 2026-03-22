-- Enable pg_trgm for trigram-based fuzzy search on client names/email.
-- GIN indexes allow similarity() and word_similarity() to use index scans
-- instead of full-table sequential scans.

-- 1. Enable the extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram index on first_name + last_name
--    Covers: similarity(first_name, $q), similarity(last_name, $q),
--    word_similarity($q, first_name || ' ' || last_name)
CREATE INDEX IF NOT EXISTS clients_name_trgm_idx
  ON profiles
  USING gin (first_name gin_trgm_ops, last_name gin_trgm_ops);

-- 3. GIN trigram index on email
--    Covers: similarity(email, $q)
CREATE INDEX IF NOT EXISTS clients_email_trgm_idx
  ON profiles
  USING gin (email gin_trgm_ops);
