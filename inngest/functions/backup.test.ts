// @vitest-environment node

/**
 * inngest/functions/backup.test.ts
 *
 * Unit tests for the backup Inngest function.
 * Verifies: running uploadBackupToStorage when storage is configured,
 * and skipping the upload (returning ok: false for storageConfigured)
 * when storage env vars are absent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Step stub                                                           */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                        */
/* ------------------------------------------------------------------ */

const MOCK_MANIFEST = {
  createdAt: "2026-04-12T00:00:00.000Z",
  summary: { _total: 1000, profiles: 200 },
  tables: {},
};

const MOCK_UPLOAD_RESULT = {
  key: "backups/2026-04-12.json.gz",
  compressedBytes: 4096,
  rawBytes: 16384,
  uploadedAt: "2026-04-12T00:01:00.000Z",
};

const mockCreateManifest = vi.fn().mockResolvedValue(MOCK_MANIFEST);
const mockIsStorageConfigured = vi.fn().mockReturnValue(true);
const mockUploadBackup = vi.fn().mockResolvedValue(MOCK_UPLOAD_RESULT);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();

function setupMocks(storageConfigured = true) {
  mockIsStorageConfigured.mockReturnValue(storageConfigured);

  vi.doMock("@/lib/backup", () => ({
    createBackupManifest: mockCreateManifest,
    isStorageConfigured: mockIsStorageConfigured,
    uploadBackupToStorage: mockUploadBackup,
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@sentry/nextjs", () => ({
    captureException: mockCaptureException,
    captureMessage: mockCaptureMessage,
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/backup");
  const fn = (mod.backup as any)?.handler ?? mod.backup;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("backup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls uploadBackupToStorage and logs success when storage is configured", async () => {
    setupMocks(true);

    const result = await runHandler();

    expect(mockCreateManifest).toHaveBeenCalledOnce();
    expect(mockUploadBackup).toHaveBeenCalledWith(MOCK_MANIFEST);
    expect(mockLogAction).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      ok: true,
      storageConfigured: true,
      key: MOCK_UPLOAD_RESULT.key,
      compressedBytes: MOCK_UPLOAD_RESULT.compressedBytes,
    });
    expect(result.compressionRatio).toMatch(/%$/);
  });

  it("skips upload and returns storageConfigured: false when storage is not set up", async () => {
    setupMocks(false);

    const result = await runHandler();

    expect(mockCreateManifest).toHaveBeenCalledOnce();
    expect(mockUploadBackup).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      storageConfigured: false,
      warning: expect.stringContaining("not set"),
      summary: MOCK_MANIFEST.summary,
    });
    // A Sentry warning + audit log should still fire
    expect(mockCaptureMessage).toHaveBeenCalledOnce();
    expect(mockLogAction).toHaveBeenCalledOnce();
  });

  it("propagates manifest creation errors (re-throws after Sentry capture)", async () => {
    mockCreateManifest.mockRejectedValueOnce(new Error("DB connection lost"));
    setupMocks(true);

    await expect(runHandler()).rejects.toThrow("DB connection lost");
    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockUploadBackup).not.toHaveBeenCalled();
  });
});
