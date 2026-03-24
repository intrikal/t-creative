/**
 * Tests for POST /api/book/waitlist — public waitlist join endpoint.
 *
 * Covers:
 *  - Input validation: invalid JSON, missing/non-numeric serviceId,
 *    nonexistent service
 *  - Guest flow: missing name/email (400), invalid email (400),
 *    reCAPTCHA failure (403), admin notification email sent on success
 *  - Authenticated flow: inserts a waitlist DB row with the user's ID,
 *    does NOT send an email (admin email is only for guests)
 *
 * Mocks: db (select/insert chains), Resend email sender, reCAPTCHA
 * verifier, Supabase auth (getUser toggles guest vs authenticated).
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

// selectIdx / selectData: stateful counter routing sequential db.select() calls to mock data
let selectIdx = 0;
let selectData: unknown[][] = [];
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockResendSend = vi.fn();
const mockVerifyRecaptcha = vi.fn();
const mockGetUser = vi.fn();

function buildDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++;
      const rows = selectData[idx] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi
        .fn()
        .mockReturnValue(Object.assign([...rows], { limit: vi.fn().mockReturnValue(rows) }));
      chain.limit = vi.fn().mockReturnValue(rows);
      return chain;
    }),
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...v: unknown[]) => {
          mockInsertValues(...v);
          return { returning: vi.fn().mockReturnValue([{ id: 1 }]) };
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("POST /api/book/waitlist", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockVerifyRecaptcha.mockResolvedValue(true);
    mockResendSend.mockResolvedValue({ id: "email-id" });
    mockGetUser.mockResolvedValue({ data: { user: null } }); // guest by default

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      profiles: { id: "id", email: "email", role: "role" },
      services: { id: "id", name: "name" },
      waitlist: { clientId: "clientId", serviceId: "serviceId" },
    }));
    vi.doMock("@/lib/resend", () => ({
      RESEND_FROM: "noreply@test.com",
      isResendConfigured: vi.fn().mockReturnValue(true),
    }));
    vi.doMock("@/lib/recaptcha", () => ({ verifyRecaptchaToken: mockVerifyRecaptcha }));
    vi.doMock("resend", () => ({
      Resend: function MockResend() {
        return { emails: { send: mockResendSend } };
      },
    }));
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  function makePost(body: unknown) {
    return new Request("https://example.com/api/book/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /* ---------- Validation ---------- */

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("https://example.com/api/book/waitlist", {
      method: "POST",
      body: "{bad json}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when serviceId is missing", async () => {
    const res = await POST(makePost({ name: "Alice", email: "a@b.com" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("serviceId") });
  });

  it("returns 400 when serviceId is non-numeric", async () => {
    const res = await POST(makePost({ serviceId: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when service does not exist", async () => {
    selectData[0] = []; // service not found
    const res = await POST(makePost({ serviceId: "999" }));
    expect(res.status).toBe(404);
  });

  /* ---------- Guest flow ---------- */

  it("returns 400 for guest missing name or email", async () => {
    selectData[0] = [{ id: 1, name: "Haircut" }]; // service found
    // user is null (guest) by default
    const res = await POST(makePost({ serviceId: "1", name: "", email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for guest with invalid email", async () => {
    selectData[0] = [{ id: 1, name: "Haircut" }];
    const res = await POST(makePost({ serviceId: "1", name: "Alice", email: "notanemail" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for guest when reCAPTCHA fails", async () => {
    selectData[0] = [{ id: 1, name: "Haircut" }];
    mockVerifyRecaptcha.mockResolvedValueOnce(false);
    const res = await POST(makePost({ serviceId: "1", name: "Alice", email: "alice@example.com" }));
    expect(res.status).toBe(403);
  });

  it("emails admin for guest waitlist request", async () => {
    selectData[0] = [{ id: 1, name: "Haircut" }]; // service
    selectData[1] = [{ email: "admin@studio.com" }]; // admin

    const res = await POST(
      makePost({
        serviceId: "1",
        name: "Alice",
        email: "alice@example.com",
        datePreference: "Fridays",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockResendSend).toHaveBeenCalledOnce();
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@studio.com",
        subject: expect.stringContaining("Haircut"),
      }),
    );
  });

  /* ---------- Authenticated flow ---------- */

  it("inserts a waitlist row for authenticated users", async () => {
    selectData[0] = [{ id: 7, name: "Color" }]; // service
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-abc" } } });

    const res = await POST(makePost({ serviceId: "7", notes: "ASAP please" }));

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "user-abc", serviceId: 7 }),
    );
    // No email for authenticated users
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
