/**
 * Tests for POST /api/cron/backup — nightly automated database backup cron.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - Manifest creation: createBackupManifest called on valid request;
 *    throws → 500 "Backup failed"
 *  - Storage not configured: isStorageConfigured returns false →
 *    200 with storageConfigured=false, warning message, no upload attempted,
 *    audit log entry with entityId="cron-no-storage"
 *  - Successful upload: uploadBackupToStorage called with manifest;
 *    response includes key, bytes, compressionRatio (75.0%), uploadedAt, summary
 *  - Audit: logAction called with S3 key as entityId after successful upload
 *  - Upload failure: uploadBackupToStorage throws → 500 "Upload failed"
 *
 * Mocks: createBackupManifest, uploadBackupToStorage, isStorageConfigured,
 * logAction (audit), Sentry (captureException, captureMessage).
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockCreateBackupManifest = vi.fn();
const mockUploadBackupToStorage = vi.fn();
const mockIsStorageConfigured = vi.fn();
const mockLogAction = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/cron/backup", () => {
  let POST: (request: Request) => Promise<Response>;

  const fakeManifest = {
    version: "1" as const,
    createdAt: "2026-03-18T00:00:00.000Z",
    source: "https://test.supabase.co",
    summary: { _total: 42, profiles: 10, bookings: 20, payments: 12 },
    groups: {} as never,
  };

  const fakeUploadResult = {
    key: "backups/2026/03/18/backup-1742256000000.json.gz",
    compressedBytes: 1024,
    rawBytes: 4096,
    uploadedAt: "2026-03-18T00:01:00.000Z",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    // Default happy-path mocks
    mockCreateBackupManifest.mockResolvedValue(fakeManifest);
    mockUploadBackupToStorage.mockResolvedValue(fakeUploadResult);
    mockIsStorageConfigured.mockReturnValue(true);
    mockLogAction.mockResolvedValue(undefined);

    vi.resetModules();

    vi.doMock("@/lib/backup", () => ({
      createBackupManifest: mockCreateBackupManifest,
      uploadBackupToStorage: mockUploadBackupToStorage,
      isStorageConfigured: mockIsStorageConfigured,
    }));

    vi.doMock("@/lib/audit", () => ({
      logAction: mockLogAction,
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: vi.fn(),
      captureMessage: vi.fn(),
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  function makePost(secret?: string): Request {
    return new Request("https://example.com/api/cron/backup", {
      method: "POST",
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 when x-cron-secret header is missing", async () => {
    const res = await POST(makePost());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when x-cron-secret header is wrong", async () => {
    const res = await POST(makePost("wrong-secret"));
    expect(res.status).toBe(401);
  });

  /* ---------- Manifest creation ---------- */

  it("calls createBackupManifest on a valid request", async () => {
    const res = await POST(makePost("test-cron-secret"));
    expect(res.status).toBe(200);
    expect(mockCreateBackupManifest).toHaveBeenCalledOnce();
  });

  it("returns 500 when createBackupManifest throws", async () => {
    mockCreateBackupManifest.mockRejectedValueOnce(new Error("DB connection refused"));
    const res = await POST(makePost("test-cron-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Backup failed");
  });

  /* ---------- Storage not configured ---------- */

  it("returns 200 with storageConfigured: false when storage is not set up", async () => {
    mockIsStorageConfigured.mockReturnValue(false);

    const res = await POST(makePost("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.storageConfigured).toBe(false);
    expect(body.warning).toMatch(/storage env vars not set/i);
    expect(body.summary).toEqual(fakeManifest.summary);
    // Upload must NOT have been attempted
    expect(mockUploadBackupToStorage).not.toHaveBeenCalled();
  });

  it("logs a no-storage audit entry when storage is not configured", async () => {
    mockIsStorageConfigured.mockReturnValue(false);

    await POST(makePost("test-cron-secret"));
    expect(mockLogAction).toHaveBeenCalledOnce();
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "export",
        entityType: "backup",
        entityId: "cron-no-storage",
      }),
    );
  });

  /* ---------- Successful upload ---------- */

  it("calls uploadBackupToStorage with the manifest when storage is configured", async () => {
    const res = await POST(makePost("test-cron-secret"));
    expect(res.status).toBe(200);
    expect(mockUploadBackupToStorage).toHaveBeenCalledOnce();
    expect(mockUploadBackupToStorage).toHaveBeenCalledWith(fakeManifest);
  });

  it("returns upload result fields on success", async () => {
    const res = await POST(makePost("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.storageConfigured).toBe(true);
    expect(body.key).toBe(fakeUploadResult.key);
    expect(body.compressedBytes).toBe(fakeUploadResult.compressedBytes);
    expect(body.rawBytes).toBe(fakeUploadResult.rawBytes);
    expect(body.uploadedAt).toBe(fakeUploadResult.uploadedAt);
    expect(body.summary).toEqual(fakeManifest.summary);
  });

  it("includes a compressionRatio in the response", async () => {
    const res = await POST(makePost("test-cron-secret"));
    const body = await res.json();
    // 1024 / 4096 = 75% compressed
    expect(body.compressionRatio).toBe("75.0%");
  });

  it("logs an audit entry after a successful upload", async () => {
    await POST(makePost("test-cron-secret"));
    expect(mockLogAction).toHaveBeenCalledOnce();
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "export",
        entityType: "backup",
        entityId: fakeUploadResult.key,
      }),
    );
  });

  /* ---------- Upload failure ---------- */

  it("returns 500 when uploadBackupToStorage throws", async () => {
    mockUploadBackupToStorage.mockRejectedValueOnce(new Error("S3 access denied"));

    const res = await POST(makePost("test-cron-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Upload failed");
  });
});
