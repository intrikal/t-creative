/**
 * Inngest function — Nightly automated database backup.
 *
 * Replaces POST /api/cron/backup. Creates a full JSON manifest via
 * createBackupManifest(). If BACKUP_S3_* env vars are configured, uploads the
 * gzip-compressed manifest to cloud storage and logs the result.
 */
import * as Sentry from "@sentry/nextjs";
import { logAction } from "@/lib/audit";
import { createBackupManifest, isStorageConfigured, uploadBackupToStorage } from "@/lib/backup";
import { inngest } from "../client";

export const backup = inngest.createFunction(
  { id: "backup", retries: 3, triggers: [{ event: "cron/backup" }] },
  async ({ step }) => {
    // Build manifest
    const manifest = await step.run("create-manifest", async () => {
      try {
        return await createBackupManifest();
      } catch (err) {
        Sentry.captureException(err, { extra: { context: "[cron/backup] Manifest creation failed" } });
        throw err;
      }
    });

    // Check if storage is configured
    const storageReady = await step.run("check-storage", async () => {
      return isStorageConfigured();
    });

    if (!storageReady) {
      await step.run("log-no-storage", async () => {
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
      });

      return {
        ok: true,
        storageConfigured: false,
        warning: "Storage env vars not set — no file was uploaded.",
        summary: manifest.summary,
      };
    }

    // Upload to storage
    const result = await step.run("upload-backup", async () => {
      try {
        return await uploadBackupToStorage(manifest);
      } catch (err) {
        Sentry.captureException(err, { extra: { context: "[cron/backup] Upload failed" } });
        throw err;
      }
    });

    await step.run("log-success", async () => {
      await logAction({
        actorId: null,
        action: "export",
        entityType: "backup",
        entityId: result.key,
        description: `Nightly backup uploaded (${manifest.summary._total ?? 0} rows, ${(result.compressedBytes / 1024).toFixed(1)} KB compressed)`,
        metadata: { ...result, summary: manifest.summary },
      });
    });

    return {
      ok: true,
      storageConfigured: true,
      key: result.key,
      compressedBytes: result.compressedBytes,
      rawBytes: result.rawBytes,
      compressionRatio: `${((1 - result.compressedBytes / result.rawBytes) * 100).toFixed(1)}%`,
      uploadedAt: result.uploadedAt,
      summary: manifest.summary,
    };
  },
);
