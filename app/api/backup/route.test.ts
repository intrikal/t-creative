/**
 * Tests for GET and POST /api/backup — admin backup download and S3 upload.
 *
 * GET tests cover:
 *  - Auth: unauthenticated (401), non-admin (403), missing profile (403)
 *  - Happy path: returns JSON attachment with correct Content-Type,
 *    Content-Disposition filename, and Cache-Control: no-store
 *  - Audit: logAction called with action="export", entityId="json-download"
 *  - Error: createBackupManifest throws → 500
 *
 * POST tests cover:
 *  - Auth: unauthenticated (401), non-admin (403)
 *  - Storage not configured: isStorageConfigured returns false → 503
 *    with hint about required env vars
 *  - Happy path: returns upload summary with key, bytes, compressionRatio
 *  - Audit: logAction called with the S3 key as entityId
 *  - Errors: manifest creation failure (500), upload failure (500)
 *
 * Mocks: Supabase auth (getUser), db.select (thenable chain),
 * createBackupManifest, isStorageConfigured, uploadBackupToStorage,
 * logAction (audit), Sentry.
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

const mockGetUser = vi.fn();
const mockLogAction = vi.fn();
const mockDbSelect = vi.fn();
const mockCreateBackupManifest = vi.fn();
const mockIsStorageConfigured = vi.fn();
const mockUploadBackupToStorage = vi.fn();

/** Returns a thenable chain that also supports limit terminals. */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  profiles: {},
}));

vi.mock("@/lib/audit", () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
}));

vi.mock("@/lib/backup", () => ({
  createBackupManifest: (...args: unknown[]) => mockCreateBackupManifest(...args),
  isStorageConfigured: (...args: unknown[]) => mockIsStorageConfigured(...args),
  uploadBackupToStorage: (...args: unknown[]) => mockUploadBackupToStorage(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                            */
/* ------------------------------------------------------------------ */

const MOCK_MANIFEST = {
  version: "1" as const,
  createdAt: "2026-03-15T00:00:00.000Z",
  source: "https://project.supabase.co",
  summary: { identity: 5, _total: 5 },
  groups: {},
};

const MOCK_UPLOAD_RESULT = {
  key: "backups/2026/03/15/backup-1742054400000.json.gz",
  compressedBytes: 512,
  rawBytes: 2048,
  uploadedAt: "2026-03-15T00:00:00.000Z",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/backup", () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-uuid" } } });
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "admin" }]));
    mockCreateBackupManifest.mockResolvedValue(MOCK_MANIFEST);
    mockLogAction.mockResolvedValue(undefined);

    const mod = await import("./route");
    GET = mod.GET;
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 403 for a non-admin user", async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "client" }]));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  it("returns 403 when profile is not found", async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns JSON attachment on success", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("t-creative-backup-");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = JSON.parse(await res.text());
    expect(body.version).toBe("1");
    expect(body.createdAt).toBe(MOCK_MANIFEST.createdAt);
  });

  it("records an audit log entry on successful download", async () => {
    await GET();
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-uuid",
        action: "export",
        entityType: "backup",
        entityId: "json-download",
      }),
    );
  });

  it("returns 500 when manifest creation fails", async () => {
    mockCreateBackupManifest.mockRejectedValue(new Error("DB down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Backup failed" });

    errorSpy.mockRestore();
  });
});

describe("POST /api/backup", () => {
  let POST: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-uuid" } } });
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "admin" }]));
    mockCreateBackupManifest.mockResolvedValue(MOCK_MANIFEST);
    mockIsStorageConfigured.mockReturnValue(true);
    mockUploadBackupToStorage.mockResolvedValue(MOCK_UPLOAD_RESULT);
    mockLogAction.mockResolvedValue(undefined);

    const mod = await import("./route");
    POST = mod.POST;
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ role: "client" }]));
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 503 when storage is not configured", async () => {
    mockIsStorageConfigured.mockReturnValue(false);
    const res = await POST();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Storage not configured");
    expect(body.hint).toBeDefined();
  });

  it("returns upload summary on success", async () => {
    const res = await POST();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key).toBe(MOCK_UPLOAD_RESULT.key);
    expect(body.compressedBytes).toBe(512);
    expect(body.rawBytes).toBe(2048);
    expect(body.compressionRatio).toBeDefined();
    expect(body.summary).toBeDefined();
  });

  it("records an audit log entry on successful upload", async () => {
    await POST();
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-uuid",
        action: "export",
        entityType: "backup",
        entityId: MOCK_UPLOAD_RESULT.key,
      }),
    );
  });

  it("returns 500 when manifest creation fails", async () => {
    mockCreateBackupManifest.mockRejectedValue(new Error("DB down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Backup failed" });

    errorSpy.mockRestore();
  });

  it("returns 500 when upload fails", async () => {
    mockUploadBackupToStorage.mockRejectedValue(new Error("S3 timeout"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Upload failed" });

    errorSpy.mockRestore();
  });
});
