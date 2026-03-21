/**
 * Tests for POST /api/book/upload-reference — public reference photo upload.
 *
 * Covers:
 *  - Validation: no file in form data (400), file exceeds 8 MB limit (400),
 *    unsupported file type like PDF (400), formData() parse error (400)
 *  - Happy path: valid JPEG upload → calls Supabase storage.upload with
 *    path under "booking-references/", contentType matching file,
 *    upsert=false; returns { url } with the public CDN URL
 *  - Supported types: all 5 allowed image types (jpeg, png, webp, heic, heif)
 *    accepted successfully
 *  - Error handling: Supabase upload error → 500, missing env vars
 *    (SUPABASE_SERVICE_ROLE_KEY) → 503
 *
 * Mocks: @supabase/supabase-js createClient (returns mock storage bucket),
 * Sentry. Uses Request.formData() spy to inject controlled FormData.
 * No auth — endpoint is public for both guests and authenticated users.
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

const mockCreateClient = vi.fn((_url: unknown, _key: unknown, _opts: unknown) => ({
  storage: { from: mockStorageFrom },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: unknown, key: unknown, opts: unknown) => mockCreateClient(url, key, opts),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Creates a Request whose formData() returns a controlled FormData.
 * We bypass the jsdom dual-realm `instanceof File` issue by stubbing
 * formData() so the route receives a real global-realm File object.
 */
function makeRequest(formDataFn?: () => Promise<FormData>): Request {
  const req = new Request("https://example.com/api/book/upload-reference", {
    method: "POST",
    body: "placeholder",
    headers: { "content-type": "text/plain" },
  });
  if (formDataFn) {
    vi.spyOn(req, "formData").mockImplementation(formDataFn);
  }
  return req;
}

function makeFile(opts: { name?: string; type?: string; size?: number } = {}): File {
  const name = opts.name ?? "photo.jpg";
  const type = opts.type ?? "image/jpeg";
  const size = opts.size ?? 1024;
  return new File([new Uint8Array(size)], name, { type });
}

function makeFormDataWith(file: File): () => Promise<FormData> {
  return async () => {
    const fd = new FormData();
    fd.append("file", file);
    return fd;
  };
}

function makeEmptyFormData(): () => Promise<FormData> {
  return async () => new FormData();
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/book/upload-reference", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    // Default happy-path mocks
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          "https://test.supabase.co/storage/v1/object/public/media/booking-references/photo.jpg",
      },
    });

    vi.resetModules();

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: (url: unknown, key: unknown, opts: unknown) => mockCreateClient(url, key, opts),
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: vi.fn(),
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ---------- Validation ---------- */

  it("returns 400 when no file is provided", async () => {
    const req = makeRequest(makeEmptyFormData());
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when file exceeds size limit", async () => {
    const bigFile = makeFile({ size: 9 * 1024 * 1024 }); // 9 MB > 8 MB limit
    const req = makeRequest(makeFormDataWith(bigFile));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/large/i);
  });

  it("returns 400 for unsupported file type", async () => {
    const pdfFile = makeFile({ name: "document.pdf", type: "application/pdf" });
    const req = makeRequest(makeFormDataWith(pdfFile));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  /* ---------- Happy path ---------- */

  it("uploads to Supabase Storage successfully", async () => {
    const file = makeFile({ name: "inspo.jpg", type: "image/jpeg" });
    const req = makeRequest(makeFormDataWith(file));
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledOnce();
    // Path should be in the "booking-references/" directory
    const [path, , opts] = mockUpload.mock.calls[0] as [
      string,
      File,
      { contentType: string; upsert: boolean },
    ];
    expect(path).toMatch(/^booking-references\//);
    expect(opts.contentType).toBe("image/jpeg");
    expect(opts.upsert).toBe(false);
  });

  it("returns the public URL on success", async () => {
    const expectedUrl =
      "https://test.supabase.co/storage/v1/object/public/media/booking-references/photo.jpg";
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: expectedUrl } });

    const file = makeFile();
    const req = makeRequest(makeFormDataWith(file));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe(expectedUrl);
  });

  /* ---------- Error handling ---------- */

  it("handles Supabase upload failure gracefully", async () => {
    mockUpload.mockResolvedValue({ error: new Error("Bucket not found") });

    const file = makeFile();
    const req = makeRequest(makeFormDataWith(file));
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 503 when Supabase env vars are not configured", async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: (url: unknown, key: unknown, opts: unknown) => mockCreateClient(url, key, opts),
    }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const file = makeFile();
    const req = makeRequest(makeFormDataWith(file));
    const res = await mod.POST(req);
    expect(res.status).toBe(503);

    // Restore for other tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("returns 400 when formData() throws", async () => {
    const req = makeRequest(async () => {
      throw new Error("invalid multipart");
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  /* ---------- Supported image types ---------- */

  it("accepts all allowed image types", async () => {
    const types = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    for (const type of types) {
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: "https://example.com/photo" },
      });

      const file = makeFile({ type, name: `photo.${type.split("/")[1]}` });
      const req = makeRequest(makeFormDataWith(file));
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});
