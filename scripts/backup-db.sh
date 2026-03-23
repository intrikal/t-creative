#!/usr/bin/env bash
# backup-db.sh — Creates a timestamped pg_dump of the production database,
# uploads it to the Supabase Storage bucket 'db-backups', and prunes backups
# older than the most recent 30.
#
# Required environment variables:
#   DIRECT_URL              — Direct Postgres connection string (port 5432)
#   NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
#   SUPABASE_SERVICE_ROLE_KEY — Service-role key (storage admin access)
#
# Usage:
#   ./scripts/backup-db.sh

set -euo pipefail

# ─── Validate required environment variables ──────────────────────────────────
: "${DIRECT_URL:?DIRECT_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

BUCKET="db-backups"
TIMESTAMP=$(date -u +"%Y-%m-%d-%H%M%S")
FILENAME="backup-${TIMESTAMP}.sql.gz"
TMPFILE="/tmp/${FILENAME}"

# ─── Step 1: Dump and compress ────────────────────────────────────────────────
echo "[backup-db] Creating dump: ${FILENAME}"
pg_dump "${DIRECT_URL}" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "${TMPFILE}"

FILESIZE=$(du -sh "${TMPFILE}" | cut -f1)
echo "[backup-db] Dump complete (${FILESIZE}): ${TMPFILE}"

# ─── Step 2: Upload to Supabase Storage ───────────────────────────────────────
STORAGE_URL="${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILENAME}"

echo "[backup-db] Uploading to Supabase Storage: ${BUCKET}/${FILENAME}"
HTTP_STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" \
  --request POST \
  --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Content-Type: application/gzip" \
  --data-binary "@${TMPFILE}" \
  "${STORAGE_URL}")

if [[ "${HTTP_STATUS}" != "200" ]]; then
  echo "[backup-db] ERROR: Upload failed with HTTP ${HTTP_STATUS}" >&2
  rm -f "${TMPFILE}"
  exit 1
fi

echo "[backup-db] Upload successful: ${BUCKET}/${FILENAME}"
rm -f "${TMPFILE}"

# ─── Step 3: List all backups and prune older than the last 30 ────────────────
LIST_URL="${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/${BUCKET}"

echo "[backup-db] Fetching backup list for pruning..."
RESPONSE=$(curl --silent --fail \
  --request POST \
  --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"prefix":"backup-","sortBy":{"column":"name","order":"asc"}}' \
  "${LIST_URL}")

# Extract names via basic JSON parsing (no jq dependency assumed)
NAMES=$(echo "${RESPONSE}" | grep -oP '"name"\s*:\s*"\Kbackup-[^"]+' | sort)
TOTAL=$(echo "${NAMES}" | grep -c '^' || true)
RETAIN=30

if [[ "${TOTAL}" -le "${RETAIN}" ]]; then
  echo "[backup-db] ${TOTAL} backup(s) present — nothing to prune (limit: ${RETAIN})"
  exit 0
fi

DELETE_COUNT=$(( TOTAL - RETAIN ))
TO_DELETE=$(echo "${NAMES}" | head -n "${DELETE_COUNT}")

echo "[backup-db] Pruning ${DELETE_COUNT} old backup(s)..."
while IFS= read -r NAME; do
  DELETE_URL="${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${NAME}"
  STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" \
    --request DELETE \
    --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    "${DELETE_URL}")
  if [[ "${STATUS}" == "200" ]]; then
    echo "[backup-db] Deleted: ${NAME}"
  else
    echo "[backup-db] WARNING: Failed to delete ${NAME} (HTTP ${STATUS})" >&2
  fi
done <<< "${TO_DELETE}"

echo "[backup-db] Done. Retained last ${RETAIN} backups."
