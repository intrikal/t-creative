// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the backup module — manifest creation, S3 storage configuration,
 * and upload functionality.
 *
 * Covers:
 *  - isStorageConfigured: all 3 S3 env vars required
 *  - createBackupManifest: correct structure, all 17 domain groups, zero-row counts,
 *    source env var handling, row counting from DB queries
 *  - uploadBackupToStorage: throws when S3 vars are missing
 *
 * Mocks: db (select for all table counts), db/schema (all 40+ tables),
 * @aws-sdk/client-s3 (S3Client + PutObjectCommand).
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockDbSelect: controls what rows each db.select().from() call returns
const mockDbSelect = vi.fn();

/** Returns a thenable chain where from() resolves to `result`. */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

// Mock the database so tests don't need a real Postgres connection
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

// Mock every table referenced by the backup module — it iterates all schema exports
// to build the manifest. Using empty objects satisfies the import without real definitions.
vi.mock("@/db/schema", () => ({
  profiles: {},
  services: {},
  serviceAddOns: {},
  serviceBundles: {},
  clientForms: {},
  bookings: {},
  bookingAddOns: {},
  payments: {},
  invoices: {},
  expenses: {},
  orders: {},
  products: {},
  productImages: {},
  promotions: {},
  clientPreferences: {},
  loyaltyTransactions: {},
  serviceRecords: {},
  reviews: {},
  formSubmissions: {},
  waitlist: {},
  giftCards: {},
  giftCardTransactions: {},
  membershipPlans: {},
  membershipSubscriptions: {},
  bookingSubscriptions: {},
  assistantProfiles: {},
  shifts: {},
  settings: {},
  policies: {},
  businessHours: {},
  timeOff: {},
  bookingRules: {},
  supplies: {},
  trainingPrograms: {},
  trainingSessions: {},
  trainingModules: {},
  trainingLessons: {},
  enrollments: {},
  certificates: {},
  lessonCompletions: {},
  sessionAttendance: {},
  eventVenues: {},
  events: {},
  eventGuests: {},
  threads: {},
  messages: {},
  threadParticipants: {},
  quickReplies: {},
  notifications: {},
  mediaItems: {},
  wishlistItems: {},
  inquiries: {},
  productInquiries: {},
  syncLog: {},
  webhookEvents: {},
  auditLog: {},
}));

// Mock the AWS SDK so tests don't need real S3 credentials
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn().mockResolvedValue({}) })),
  PutObjectCommand: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/backup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Default: every db.select().from() returns []
    mockDbSelect.mockReturnValue(makeSelectChain([]));
  });

  describe("isStorageConfigured", () => {
    it("returns true when all three S3 env vars are set", async () => {
      vi.stubEnv("BACKUP_S3_BUCKET", "my-bucket");
      vi.stubEnv("BACKUP_S3_ACCESS_KEY_ID", "key-id");
      vi.stubEnv("BACKUP_S3_SECRET_ACCESS_KEY", "secret-key");

      const { isStorageConfigured } = await import("./backup");
      expect(isStorageConfigured()).toBe(true);
    });

    it("returns false when BACKUP_S3_BUCKET is missing", async () => {
      vi.stubEnv("BACKUP_S3_BUCKET", "");
      vi.stubEnv("BACKUP_S3_ACCESS_KEY_ID", "key-id");
      vi.stubEnv("BACKUP_S3_SECRET_ACCESS_KEY", "secret-key");

      const { isStorageConfigured } = await import("./backup");
      expect(isStorageConfigured()).toBe(false);
    });

    it("returns false when BACKUP_S3_ACCESS_KEY_ID is missing", async () => {
      vi.stubEnv("BACKUP_S3_BUCKET", "my-bucket");
      vi.stubEnv("BACKUP_S3_ACCESS_KEY_ID", "");
      vi.stubEnv("BACKUP_S3_SECRET_ACCESS_KEY", "secret-key");

      const { isStorageConfigured } = await import("./backup");
      expect(isStorageConfigured()).toBe(false);
    });

    it("returns false when BACKUP_S3_SECRET_ACCESS_KEY is missing", async () => {
      vi.stubEnv("BACKUP_S3_BUCKET", "my-bucket");
      vi.stubEnv("BACKUP_S3_ACCESS_KEY_ID", "key-id");
      vi.stubEnv("BACKUP_S3_SECRET_ACCESS_KEY", "");

      const { isStorageConfigured } = await import("./backup");
      expect(isStorageConfigured()).toBe(false);
    });

    it("returns false when all env vars are missing", async () => {
      vi.stubEnv("BACKUP_S3_BUCKET", "");
      vi.stubEnv("BACKUP_S3_ACCESS_KEY_ID", "");
      vi.stubEnv("BACKUP_S3_SECRET_ACCESS_KEY", "");

      const { isStorageConfigured } = await import("./backup");
      expect(isStorageConfigured()).toBe(false);
    });
  });

  describe("createBackupManifest", () => {
    it("returns a manifest with correct structure", async () => {
      const { createBackupManifest } = await import("./backup");
      const manifest = await createBackupManifest();

      expect(manifest.version).toBe("1");
      expect(typeof manifest.createdAt).toBe("string");
      expect(new Date(manifest.createdAt).toISOString()).toBe(manifest.createdAt);
      expect(manifest.summary).toBeDefined();
      expect(manifest.groups).toBeDefined();
    });

    it("includes all expected domain groups", async () => {
      const { createBackupManifest } = await import("./backup");
      const manifest = await createBackupManifest();

      const expectedGroups = [
        "identity",
        "services",
        "bookings",
        "payments",
        "commerce",
        "crm",
        "giftCards",
        "memberships",
        "staff",
        "configuration",
        "training",
        "events",
        "communications",
        "media",
        "inquiries",
        "integrationLogs",
        "audit",
      ];

      for (const group of expectedGroups) {
        expect(manifest.groups).toHaveProperty(group);
        expect(manifest.groups[group as keyof typeof manifest.groups]).toHaveProperty("totalRows");
        expect(manifest.groups[group as keyof typeof manifest.groups]).toHaveProperty("tables");
      }
    });

    it("reports zero totalRows and correct _total when database is empty", async () => {
      const { createBackupManifest } = await import("./backup");
      const manifest = await createBackupManifest();

      expect(manifest.summary._total).toBe(0);
      for (const group of Object.values(manifest.groups)) {
        expect(group.totalRows).toBe(0);
      }
    });

    it("sets source from NEXT_PUBLIC_SUPABASE_URL env var", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

      const { createBackupManifest } = await import("./backup");
      const manifest = await createBackupManifest();

      expect(manifest.source).toBe("https://project.supabase.co");
    });

    it("defaults source to 'unknown' when env var is not set", async () => {
      // stubEnv("", ...) still sets the var — we must delete it for ?? fallback
      const saved = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        const { createBackupManifest } = await import("./backup");
        const manifest = await createBackupManifest();
        expect(manifest.source).toBe("unknown");
      } finally {
        if (saved !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved;
      }
    });

    it("counts rows from mocked database queries", async () => {
      // Return 2 rows for profiles (identity group)
      mockDbSelect.mockReturnValue(makeSelectChain([{ id: "u1" }, { id: "u2" }]));

      const { createBackupManifest } = await import("./backup");
      const manifest = await createBackupManifest();

      // Every table returns 2 rows — verify the identity group reflects that
      expect(manifest.groups.identity.tables["profiles"].count).toBe(2);
      expect(manifest.groups.identity.totalRows).toBe(2);
    });
  });

  describe("uploadBackupToStorage", () => {
    it("throws when S3 env vars are missing", async () => {
      vi.stubEnv("BACKUP_S3_BUCKET", "");
      vi.stubEnv("BACKUP_S3_ACCESS_KEY_ID", "");
      vi.stubEnv("BACKUP_S3_SECRET_ACCESS_KEY", "");

      const { uploadBackupToStorage, createBackupManifest } = await import("./backup");
      const manifest = await createBackupManifest();

      await expect(uploadBackupToStorage(manifest)).rejects.toThrow("Missing required env vars");
    });
  });
});
