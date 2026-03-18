/**
 * POST /api/cron/backup — Nightly automated database backup.
 *
 * ## Authentication
 * Requires `x-cron-secret` header matching the CRON_SECRET env var.
 * This endpoint is called by the pg_cron job defined in:
 *   supabase/migrations/20260315_nightly_backup_cron.sql
 *
 * ## Behaviour
 * 1. Creates a full JSON manifest via `createBackupManifest()`.
 * 2. If BACKUP_S3_* env vars are configured, uploads the gzip-compressed
 *    manifest to cloud storage and logs the result.
 * 3. If storage is not configured, logs a warning and returns success — this
 *    allows the cron to run harmlessly while storage is being set up, and the
 *    admin can still use GET /api/backup for manual downloads.
 *
 * ## Response
 *   200  { ok: true, key?, compressedBytes?, rawBytes?, summary, storageConfigured }
 *   401  Missing or invalid cron secret
 *   500  Backup or upload failed
 *
 * @example
 *   # Test manually (replace with real secret)
 *   curl -X POST https://tcreativestudio.com/api/cron/backup \
 *     -H "x-cron-secret: your-cron-secret"
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logAction } from "@/lib/audit";
import { createBackupManifest, isStorageConfigured, uploadBackupToStorage } from "@/lib/backup";

export async function POST(request: Request) {
  /* ── Auth: cron secret ── */
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* ── Build manifest ── */
  let manifest;
  try {
    manifest = await createBackupManifest();
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "[cron/backup] Manifest creation failed" } });
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }

  /* ── Upload to storage (if configured) ── */
  if (!isStorageConfigured()) {
    Sentry.captureMessage(
      "[cron/backup] Storage not configured — skipping upload. " +
        "Set BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY to enable.",
      "warning",
    );

    await logAction({
      actorId: null,
      action: "export",
      entityType: "backup",
      entityId: "cron-no-storage",
      description: `Nightly backup ran but storage is not configured (${manifest.summary._total ?? 0} rows scanned)`,
      metadata: { summary: manifest.summary, createdAt: manifest.createdAt },
    });

    return NextResponse.json({
      ok: true,
      storageConfigured: false,
      warning: "Storage env vars not set — no file was uploaded.",
      summary: manifest.summary,
    });
  }

  let result;
  try {
    result = await uploadBackupToStorage(manifest);
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "[cron/backup] Upload failed" } });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await logAction({
    actorId: null,
    action: "export",
    entityType: "backup",
    entityId: result.key,
    description: `Nightly backup uploaded (${manifest.summary._total ?? 0} rows, ${(result.compressedBytes / 1024).toFixed(1)} KB compressed)`,
    metadata: { ...result, summary: manifest.summary },
  });

  return NextResponse.json({
    ok: true,
    storageConfigured: true,
    key: result.key,
    compressedBytes: result.compressedBytes,
    rawBytes: result.rawBytes,
    compressionRatio: `${((1 - result.compressedBytes / result.rawBytes) * 100).toFixed(1)}%`,
    uploadedAt: result.uploadedAt,
    summary: manifest.summary,
  });
}
