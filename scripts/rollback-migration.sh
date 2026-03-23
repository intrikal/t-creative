#!/usr/bin/env bash
# rollback-migration.sh — Reverts a named Drizzle migration using drizzle-kit drop
# and logs the rollback event to Sentry as an informational capture.
#
# Required environment variables:
#   DIRECT_URL   — Direct Postgres connection string (port 5432)
#   SENTRY_DSN   — Sentry DSN for server-side event capture
#
# Usage:
#   ./scripts/rollback-migration.sh <migration-name>
#   Example: ./scripts/rollback-migration.sh 0051_polite_silver_surfer

set -euo pipefail

# ─── Arguments ────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <migration-name>" >&2
  echo "Example: $0 0051_polite_silver_surfer" >&2
  exit 1
fi

MIGRATION_NAME="$1"

# ─── Validate required environment variables ──────────────────────────────────
: "${DIRECT_URL:?DIRECT_URL is required}"
: "${SENTRY_DSN:?SENTRY_DSN is required}"

# ─── Step 1: Run drizzle-kit drop ─────────────────────────────────────────────
echo "[rollback-migration] Rolling back migration: ${MIGRATION_NAME}"

npx drizzle-kit drop --config=drizzle.config.ts

ROLLBACK_STATUS=$?
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ "${ROLLBACK_STATUS}" -ne 0 ]]; then
  echo "[rollback-migration] ERROR: drizzle-kit drop exited with status ${ROLLBACK_STATUS}" >&2
  exit "${ROLLBACK_STATUS}"
fi

echo "[rollback-migration] Migration dropped successfully."

# ─── Step 2: Log rollback event to Sentry ─────────────────────────────────────
# Sentry Store API — sends a minimal informational event.
# Extract DSN parts: https://<key>@<host>/projects/<project_id>
SENTRY_KEY=$(echo "${SENTRY_DSN}" | grep -oP 'https://\K[^@]+')
SENTRY_HOST=$(echo "${SENTRY_DSN}" | grep -oP '@\K[^/]+')
SENTRY_PROJECT_ID=$(echo "${SENTRY_DSN}" | grep -oP '/\K[0-9]+$')

SENTRY_ENVELOPE_URL="https://${SENTRY_HOST}/api/${SENTRY_PROJECT_ID}/envelope/"
ACTOR="${GITHUB_ACTOR:-$(whoami)}"
HOSTNAME="${HOSTNAME:-$(hostname)}"
EVENT_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || echo "$(date +%s%N)")
# Sentry envelope format requires 32-char hex event_id
EVENT_ID_HEX=$(echo "${EVENT_ID}" | tr -d '-' | head -c 32)

ENVELOPE_HEADER="{\"dsn\":\"${SENTRY_DSN}\",\"sdk\":{\"name\":\"sentry.shell\",\"version\":\"1.0.0\"}}"
ITEM_HEADER="{\"type\":\"event\"}"
ITEM_PAYLOAD=$(printf '{
  "event_id": "%s",
  "timestamp": "%s",
  "level": "info",
  "message": "Database migration rolled back: %s",
  "logger": "rollback-migration.sh",
  "tags": {
    "migration": "%s",
    "actor": "%s",
    "environment": "production"
  },
  "server_name": "%s",
  "platform": "other"
}' "${EVENT_ID_HEX}" "${TIMESTAMP}" "${MIGRATION_NAME}" "${MIGRATION_NAME}" "${ACTOR}" "${HOSTNAME}")

echo "[rollback-migration] Sending rollback event to Sentry..."
HTTP_STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" \
  --request POST \
  --header "Content-Type: application/x-sentry-envelope" \
  --header "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${SENTRY_KEY}, sentry_client=sentry.shell/1.0.0" \
  --data-binary "$(printf '%s\n%s\n%s' "${ENVELOPE_HEADER}" "${ITEM_HEADER}" "${ITEM_PAYLOAD}")" \
  "${SENTRY_ENVELOPE_URL}")

if [[ "${HTTP_STATUS}" == "200" ]]; then
  echo "[rollback-migration] Sentry event logged (HTTP 200)."
else
  echo "[rollback-migration] WARNING: Sentry event failed (HTTP ${HTTP_STATUS}) — rollback still succeeded." >&2
fi

echo "[rollback-migration] Done: ${MIGRATION_NAME} rolled back at ${TIMESTAMP}."
