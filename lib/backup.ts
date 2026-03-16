/**
 * lib/backup.ts — Full-database backup utilities.
 *
 * ## What this does
 * `createBackupManifest()` queries every table in the Drizzle schema and returns
 * a structured JSON snapshot grouped by business domain. Each group tracks row
 * counts so you can verify completeness at a glance.
 *
 * ## Upload
 * `uploadBackupToStorage()` gzip-compresses the manifest and uploads it to any
 * S3-compatible object store (AWS S3, Cloudflare R2, Backblaze B2). Upload is
 * **optional** — the manifest can be returned directly from the admin endpoint
 * for manual download without configuring any storage credentials.
 *
 * ## Storage key format
 *   {BACKUP_S3_KEY_PREFIX}/YYYY/MM/DD/backup-{timestamp}.json.gz
 *   e.g. backups/2026/03/15/backup-1742054400000.json.gz
 *
 * ## Required env vars (upload only)
 *   BACKUP_S3_BUCKET              — bucket name
 *   BACKUP_S3_ACCESS_KEY_ID       — access key / key ID
 *   BACKUP_S3_SECRET_ACCESS_KEY   — secret key
 *
 * ## Optional env vars
 *   BACKUP_S3_REGION              — defaults to "auto" (works for R2 + Backblaze)
 *   BACKUP_S3_ENDPOINT            — custom endpoint URL for R2 / Backblaze (omit for AWS S3)
 *   BACKUP_S3_KEY_PREFIX          — storage path prefix, defaults to "backups"
 *
 * ## Restoration
 * See docs/RECOVERY_RUNBOOK.md for step-by-step restore procedures.
 */

import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import * as schema from "@/db/schema";

const gzipAsync = promisify(gzip);

/* ------------------------------------------------------------------ */
/*  Manifest types                                                      */
/* ------------------------------------------------------------------ */

export interface BackupTableGroup {
  /** Total rows captured in this group. */
  totalRows: number;
  /** Map of table name → rows. Row shape matches the Drizzle select type. */
  tables: Record<string, { count: number; rows: unknown[] }>;
}

export interface BackupManifest {
  /** Semver-style version so restore scripts can handle format changes. */
  version: "1";
  /** ISO 8601 timestamp of when this snapshot was taken. */
  createdAt: string;
  /** Supabase project URL — identifies which project the backup came from. */
  source: string;
  /** Summary row counts per domain for quick integrity checks. */
  summary: Record<string, number>;
  /** Full table data, grouped by business domain. */
  groups: {
    identity: BackupTableGroup;
    services: BackupTableGroup;
    bookings: BackupTableGroup;
    payments: BackupTableGroup;
    commerce: BackupTableGroup;
    crm: BackupTableGroup;
    giftCards: BackupTableGroup;
    memberships: BackupTableGroup;
    staff: BackupTableGroup;
    configuration: BackupTableGroup;
    training: BackupTableGroup;
    events: BackupTableGroup;
    communications: BackupTableGroup;
    media: BackupTableGroup;
    inquiries: BackupTableGroup;
    integrationLogs: BackupTableGroup;
    audit: BackupTableGroup;
  };
}

/* ------------------------------------------------------------------ */
/*  Group builder helper                                               */
/* ------------------------------------------------------------------ */

function makeGroup(tables: Record<string, unknown[]>): BackupTableGroup {
  const result: BackupTableGroup = { totalRows: 0, tables: {} };
  for (const [name, rows] of Object.entries(tables)) {
    result.tables[name] = { count: rows.length, rows };
    result.totalRows += rows.length;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Main backup function                                               */
/* ------------------------------------------------------------------ */

/**
 * Query every table in parallel, grouped by domain. Returns a typed manifest
 * ready for JSON serialisation or upload. Throws on any query failure so the
 * caller (cron or API route) can surface the error cleanly.
 */
export async function createBackupManifest(): Promise<BackupManifest> {
  // All groups fetched concurrently — each Promise.all within a group is also
  // parallel, so total wall-clock time ≈ slowest single query.
  const [
    identityRows,
    servicesRows,
    bookingsRows,
    paymentsRows,
    commerceRows,
    crmRows,
    giftCardRows,
    membershipRows,
    staffRows,
    configRows,
    trainingRows,
    eventsRows,
    commsRows,
    mediaRows,
    inquiryRows,
    integrationRows,
    auditRows,
  ] = await Promise.all([
    /* ── Identity & RBAC ── */
    Promise.all([db.select().from(schema.profiles)]),

    /* ── Service catalog ── */
    Promise.all([
      db.select().from(schema.services),
      db.select().from(schema.serviceAddOns),
      db.select().from(schema.serviceBundles),
      db.select().from(schema.clientForms),
    ]),

    /* ── Bookings & appointments ── */
    Promise.all([db.select().from(schema.bookings), db.select().from(schema.bookingAddOns)]),

    /* ── Payments & finance ── */
    Promise.all([
      db.select().from(schema.payments),
      db.select().from(schema.invoices),
      db.select().from(schema.expenses),
    ]),

    /* ── Commerce (orders, products, promotions) ── */
    Promise.all([
      db.select().from(schema.orders),
      db.select().from(schema.products),
      db.select().from(schema.productImages),
      db.select().from(schema.promotions),
    ]),

    /* ── CRM (per-client data) ── */
    Promise.all([
      db.select().from(schema.clientPreferences),
      db.select().from(schema.loyaltyTransactions),
      db.select().from(schema.serviceRecords),
      db.select().from(schema.reviews),
      db.select().from(schema.formSubmissions),
      db.select().from(schema.waitlist),
    ]),

    /* ── Gift cards ── */
    Promise.all([
      db.select().from(schema.giftCards),
      db.select().from(schema.giftCardTransactions),
    ]),

    /* ── Memberships & subscriptions ── */
    Promise.all([
      db.select().from(schema.membershipPlans),
      db.select().from(schema.membershipSubscriptions),
      db.select().from(schema.bookingSubscriptions),
    ]),

    /* ── Staff ── */
    Promise.all([db.select().from(schema.assistantProfiles), db.select().from(schema.shifts)]),

    /* ── Configuration & availability ── */
    Promise.all([
      db.select().from(schema.settings),
      db.select().from(schema.policies),
      db.select().from(schema.businessHours),
      db.select().from(schema.timeOff),
      db.select().from(schema.bookingRules),
      db.select().from(schema.supplies),
    ]),

    /* ── Training programs ── */
    Promise.all([
      db.select().from(schema.trainingPrograms),
      db.select().from(schema.trainingSessions),
      db.select().from(schema.trainingModules),
      db.select().from(schema.trainingLessons),
      db.select().from(schema.enrollments),
      db.select().from(schema.certificates),
      db.select().from(schema.lessonCompletions),
      db.select().from(schema.sessionAttendance),
    ]),

    /* ── Events ── */
    Promise.all([
      db.select().from(schema.eventVenues),
      db.select().from(schema.events),
      db.select().from(schema.eventGuests),
    ]),

    /* ── Communications ── */
    Promise.all([
      db.select().from(schema.threads),
      db.select().from(schema.messages),
      db.select().from(schema.threadParticipants),
      db.select().from(schema.quickReplies),
      db.select().from(schema.notifications),
    ]),

    /* ── Media & wishlists ── */
    Promise.all([db.select().from(schema.mediaItems), db.select().from(schema.wishlistItems)]),

    /* ── Inquiries ── */
    Promise.all([db.select().from(schema.inquiries), db.select().from(schema.productInquiries)]),

    /* ── Integration logs (Square / Zoho sync state) ── */
    Promise.all([db.select().from(schema.syncLog), db.select().from(schema.webhookEvents)]),

    /* ── Audit log ── */
    Promise.all([db.select().from(schema.auditLog)]),
  ]);

  /* ── Build groups ── */
  const groups: BackupManifest["groups"] = {
    identity: makeGroup({ profiles: identityRows[0] }),

    services: makeGroup({
      services: servicesRows[0],
      serviceAddOns: servicesRows[1],
      serviceBundles: servicesRows[2],
      clientForms: servicesRows[3],
    }),

    bookings: makeGroup({
      bookings: bookingsRows[0],
      bookingAddOns: bookingsRows[1],
    }),

    payments: makeGroup({
      payments: paymentsRows[0],
      invoices: paymentsRows[1],
      expenses: paymentsRows[2],
    }),

    commerce: makeGroup({
      orders: commerceRows[0],
      products: commerceRows[1],
      productImages: commerceRows[2],
      promotions: commerceRows[3],
    }),

    crm: makeGroup({
      clientPreferences: crmRows[0],
      loyaltyTransactions: crmRows[1],
      serviceRecords: crmRows[2],
      reviews: crmRows[3],
      formSubmissions: crmRows[4],
      waitlist: crmRows[5],
    }),

    giftCards: makeGroup({
      giftCards: giftCardRows[0],
      giftCardTransactions: giftCardRows[1],
    }),

    memberships: makeGroup({
      membershipPlans: membershipRows[0],
      membershipSubscriptions: membershipRows[1],
      bookingSubscriptions: membershipRows[2],
    }),

    staff: makeGroup({
      assistantProfiles: staffRows[0],
      shifts: staffRows[1],
    }),

    configuration: makeGroup({
      settings: configRows[0],
      policies: configRows[1],
      businessHours: configRows[2],
      timeOff: configRows[3],
      bookingRules: configRows[4],
      supplies: configRows[5],
    }),

    training: makeGroup({
      trainingPrograms: trainingRows[0],
      trainingSessions: trainingRows[1],
      trainingModules: trainingRows[2],
      trainingLessons: trainingRows[3],
      enrollments: trainingRows[4],
      certificates: trainingRows[5],
      lessonCompletions: trainingRows[6],
      sessionAttendance: trainingRows[7],
    }),

    events: makeGroup({
      eventVenues: eventsRows[0],
      events: eventsRows[1],
      eventGuests: eventsRows[2],
    }),

    communications: makeGroup({
      threads: commsRows[0],
      messages: commsRows[1],
      threadParticipants: commsRows[2],
      quickReplies: commsRows[3],
      notifications: commsRows[4],
    }),

    media: makeGroup({
      mediaItems: mediaRows[0],
      wishlistItems: mediaRows[1],
    }),

    inquiries: makeGroup({
      inquiries: inquiryRows[0],
      productInquiries: inquiryRows[1],
    }),

    integrationLogs: makeGroup({
      syncLog: integrationRows[0],
      webhookEvents: integrationRows[1],
    }),

    audit: makeGroup({
      auditLog: auditRows[0],
    }),
  };

  /* ── Build summary (one row-count per group for quick health check) ── */
  const summary: Record<string, number> = {};
  let grandTotal = 0;
  for (const [name, group] of Object.entries(groups)) {
    summary[name] = group.totalRows;
    grandTotal += group.totalRows;
  }
  summary._total = grandTotal;

  return {
    version: "1",
    createdAt: new Date().toISOString(),
    source: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unknown",
    summary,
    groups,
  };
}

/* ------------------------------------------------------------------ */
/*  S3-compatible upload                                               */
/* ------------------------------------------------------------------ */

export interface UploadResult {
  /** Full S3 object key the backup was stored under. */
  key: string;
  /** Byte size of the compressed payload. */
  compressedBytes: number;
  /** Byte size of the raw JSON before compression. */
  rawBytes: number;
  /** ISO 8601 timestamp. */
  uploadedAt: string;
}

/**
 * Returns true when all required S3 env vars are present. Call this before
 * `uploadBackupToStorage()` to decide whether upload is possible.
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.BACKUP_S3_BUCKET &&
    process.env.BACKUP_S3_ACCESS_KEY_ID &&
    process.env.BACKUP_S3_SECRET_ACCESS_KEY
  );
}

/**
 * Gzip-compress `manifest` and PUT it into the configured S3-compatible bucket.
 *
 * Storage key format:
 *   {prefix}/YYYY/MM/DD/backup-{timestamp}.json.gz
 *
 * Throws if required env vars are missing or the upload fails.
 */
export async function uploadBackupToStorage(manifest: BackupManifest): Promise<UploadResult> {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing required env vars: BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY",
    );
  }

  const region = process.env.BACKUP_S3_REGION ?? "auto";
  const endpoint = process.env.BACKUP_S3_ENDPOINT; // undefined = AWS S3
  const prefix = process.env.BACKUP_S3_KEY_PREFIX ?? "backups";

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint, forcePathStyle: false } : {}),
  });

  /* Build dated key: backups/2026/03/15/backup-1742054400000.json.gz */
  const now = new Date(manifest.createdAt);
  const datePath = [
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("/");
  const key = `${prefix}/${datePath}/backup-${now.getTime()}.json.gz`;

  const json = JSON.stringify(manifest);
  const rawBytes = Buffer.byteLength(json, "utf8");
  const compressed = await gzipAsync(Buffer.from(json, "utf8"));

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: compressed,
      ContentType: "application/gzip",
      ContentEncoding: "gzip",
      Metadata: {
        "backup-version": manifest.version,
        "backup-source": manifest.source,
        "backup-total-rows": String(manifest.summary._total ?? 0),
        "backup-created-at": manifest.createdAt,
      },
    }),
  );

  return {
    key,
    compressedBytes: compressed.length,
    rawBytes,
    uploadedAt: manifest.createdAt,
  };
}
