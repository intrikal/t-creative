// @vitest-environment node

/**
 * Tests for POST /api/upload-client-photo — Client photo upload endpoint.
 *
 * Covers:
 *  - Auth: unauthenticated (requireStaff throws) → 401
 *  - No file field in form data → 400
 *  - File exceeds 10 MB limit → 400
 *  - Disallowed MIME type → 400
 *  - Missing/invalid metadata fields → 400
 *  - Booking not found or wrong client → 404
 *  - Supabase upload error → 500
 *  - Happy path: valid file + metadata → stores file, inserts row, returns 200 with id + url
 *
 * Mocks: @/lib/auth (requireStaff), @/db (select/insert chains),
 * @/db/schema, @/utils/supabase/server (createClient), @sentry/nextjs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockRequireStaff = vi.fn();
const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();

function buildDb(bookingRows: object[] = [], insertedId = 42) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(bookingRows),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: insertedId }]),
      }),
    }),
  };
}

function buildSupabase() {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("POST /api/upload-client-photo", () => {
  let POST: (request: Request) => Promise<Response>;

  const VALID_PROFILE_ID = "550e8400-e29b-41d4-a716-446655440000";
  const VALID_BOOKING = { id: 1 };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireStaff.mockResolvedValue({ id: "staff-1", role: "admin" });
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed-url" },
    });

    vi.resetModules();

    vi.doMock("@/lib/auth", () => ({ requireStaff: mockRequireStaff }));
    vi.doMock("@/db", () => ({ db: buildDb([VALID_BOOKING]) }));
    vi.doMock("@/db/schema", () => ({
      bookings: { id: "id", clientId: "clientId", deletedAt: "deletedAt" },
      clientPhotos: {
        id: "id",
        bookingId: "bookingId",
        profileId: "profileId",
        uploadedBy: "uploadedBy",
        photoType: "photoType",
        storagePath: "storagePath",
        notes: "notes",
      },
    }));
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(buildSupabase()),
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(),
      and: vi.fn(),
      isNull: vi.fn(),
    }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  function makeRequest(formData: FormData) {
    return new Request("https://example.com/api/upload-client-photo", {
      method: "POST",
      body: formData,
    });
  }

  function makeFormData(overrides: {
    file?: File | null;
    bookingId?: string;
    profileId?: string;
    photoType?: string;
    notes?: string;
  } = {}) {
    const fd = new FormData();
    const file =
      overrides.file !== undefined
        ? overrides.file
        : new File(["pixel"], "photo.jpg", { type: "image/jpeg" });

    if (file !== null) fd.append("file", file);
    fd.append("bookingId", overrides.bookingId ?? "1");
    fd.append("profileId", overrides.profileId ?? VALID_PROFILE_ID);
    fd.append("photoType", overrides.photoType ?? "before");
    if (overrides.notes) fd.append("notes", overrides.notes);
    return fd;
  }

  /* ---------- Auth ---------- */

  it("returns 401 when requireStaff throws", async () => {
    mockRequireStaff.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(makeRequest(makeFormData()));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  /* ---------- Validation: file ---------- */

  it("returns 400 when no file field is present in form data", async () => {
    const fd = makeFormData({ file: null });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no file/i);
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    // Create a real oversized buffer so Node.js File.size reflects the true byte length
    const bigContent = new Uint8Array(10 * 1024 * 1024 + 1);
    const bigFile = new File([bigContent], "big.jpg", { type: "image/jpeg" });
    const res = await POST(makeRequest(makeFormData({ file: bigFile })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
  });

  it("returns 400 for a disallowed MIME type", async () => {
    const pdfFile = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(makeFormData({ file: pdfFile })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  /* ---------- Validation: metadata ---------- */

  it("returns 400 when bookingId is not a number", async () => {
    const res = await POST(makeRequest(makeFormData({ bookingId: "not-a-number" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/metadata/i);
  });

  it("returns 400 when profileId is not a valid UUID", async () => {
    const res = await POST(makeRequest(makeFormData({ profileId: "bad-uuid" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/metadata/i);
  });

  it("returns 400 when photoType is not an allowed value", async () => {
    const res = await POST(makeRequest(makeFormData({ photoType: "selfie" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/metadata/i);
  });

  /* ---------- Booking lookup ---------- */

  it("returns 404 when booking is not found", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({ requireStaff: mockRequireStaff }));
    vi.doMock("@/db", () => ({ db: buildDb([]) })); // empty — no booking
    vi.doMock("@/db/schema", () => ({
      bookings: { id: "id", clientId: "clientId", deletedAt: "deletedAt" },
      clientPhotos: { id: "id", bookingId: "bookingId", profileId: "profileId", uploadedBy: "uploadedBy", photoType: "photoType", storagePath: "storagePath", notes: "notes" },
    }));
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(buildSupabase()),
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNull: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const res = await mod.POST(makeRequest(makeFormData()));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/booking not found/i);
  });

  /* ---------- Upload error ---------- */

  it("returns 500 when Supabase upload fails", async () => {
    mockUpload.mockResolvedValue({ error: new Error("Storage quota exceeded") });
    const res = await POST(makeRequest(makeFormData()));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/upload failed/i);
  });

  /* ---------- Happy path ---------- */

  it("returns 200 with id and url on a successful upload", async () => {
    const res = await POST(makeRequest(makeFormData({ photoType: "after", notes: "Great result" })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(42);
    expect(body.url).toBe("https://storage.example.com/signed-url");
  });

  it("accepts all allowed MIME types", async () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      const file = new File(["data"], `photo.${type.split("/")[1]}`, { type });
      const res = await POST(makeRequest(makeFormData({ file })));
      expect(res.status).toBe(200);
    }
  });
});
