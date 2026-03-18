/**
 * GET  /api/backup          — Download a full JSON snapshot (admin only).
 * POST /api/backup          — Trigger an off-site upload to S3 storage (admin only).
 *
 * ## Authentication
 * Both methods require an authenticated admin session (role = "admin").
 * Cron-triggered backups use /api/cron/backup instead (x-cron-secret auth).
 *
 * ## GET — manual download
 * Returns the raw manifest JSON as a downloadable file with filename:
 *   t-creative-backup-YYYY-MM-DD.json
 *
 * Use this when you want a local copy without configuring cloud storage, or to
 * verify what a backup contains before setting up automated uploads.
 *
 * ## POST — push to storage
 * Calls `uploadBackupToStorage()` and returns a JSON summary:
 *   { key, compressedBytes, rawBytes, uploadedAt, summary }
 *
 * Requires BACKUP_S3_* env vars. Returns 503 if storage is not configured.
 *
 * Both operations are recorded in the audit log.
 *
 * @example
 *   # Download a snapshot locally
 *   curl -H "Cookie: ..." https://tcreativestudio.com/api/backup > backup.json
 *
 *   # Push a snapshot to S3 and get a receipt
 *   curl -X POST -H "Cookie: ..." https://tcreativestudio.com/api/backup
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { createBackupManifest, isStorageConfigured, uploadBackupToStorage } from "@/lib/backup";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth helper                                                         */
/* ------------------------------------------------------------------ */

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}

/* ------------------------------------------------------------------ */
/*  GET — download JSON snapshot                                        */
/* ------------------------------------------------------------------ */

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let manifest;
  try {
    manifest = await createBackupManifest();
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "[backup] Manifest creation failed" } });
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }

  await logAction({
    actorId: auth.userId,
    action: "export",
    entityType: "backup",
    entityId: "json-download",
    description: `Admin downloaded full database backup (${manifest.summary._total ?? 0} rows)`,
    metadata: { summary: manifest.summary, createdAt: manifest.createdAt },
  });

  const filename = `t-creative-backup-${manifest.createdAt.split("T")[0]}.json`;
  const json = JSON.stringify(manifest, null, 2);

  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/* ------------------------------------------------------------------ */
/*  POST — push snapshot to S3-compatible storage                      */
/* ------------------------------------------------------------------ */

export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error: "Storage not configured",
        hint: "Set BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, and BACKUP_S3_SECRET_ACCESS_KEY.",
      },
      { status: 503 },
    );
  }

  let manifest;
  try {
    manifest = await createBackupManifest();
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "[backup] Manifest creation failed" } });
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }

  let result;
  try {
    result = await uploadBackupToStorage(manifest);
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "[backup] Upload failed" } });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await logAction({
    actorId: auth.userId,
    action: "export",
    entityType: "backup",
    entityId: result.key,
    description: `Admin pushed backup to storage (${manifest.summary._total ?? 0} rows, ${(result.compressedBytes / 1024).toFixed(1)} KB compressed)`,
    metadata: { ...result, summary: manifest.summary },
  });

  return NextResponse.json({
    ok: true,
    key: result.key,
    compressedBytes: result.compressedBytes,
    rawBytes: result.rawBytes,
    compressionRatio: `${((1 - result.compressedBytes / result.rawBytes) * 100).toFixed(1)}%`,
    uploadedAt: result.uploadedAt,
    summary: manifest.summary,
  });
}
