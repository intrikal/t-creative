/**
 * Tests for POST /api/book/guest-request — public booking request endpoint.
 *
 * Covers:
 *  - Input validation: invalid JSON, missing required fields, empty name,
 *    invalid email format, nonexistent service
 *  - reCAPTCHA bot-check rejection (403)
 *  - Happy path: service found + admin exists → sends notification email to admin
 *  - Graceful degradation: no admin profile → 200 without sending email
 *  - Reference photo URLs included in the email HTML
 *
 * Mocks: db (select chain), Resend email sender, reCAPTCHA verifier.
 * Does NOT mock Supabase auth — this route is fully unauthenticated.
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

// selectIdx / selectData: stateful counter that routes each sequential db.select()
// call to the correct mock data array — simulates multiple DB queries in order
let selectIdx = 0;
let selectData: unknown[][] = [];
// mockInsert: captures db.insert() table reference calls
const mockInsert = vi.fn();
// mockInsertValues: captures the row data passed to .values()
const mockInsertValues = vi.fn();
// mockResendSend: captures Resend SDK emails.send() calls
const mockResendSend = vi.fn();
// mockVerifyRecaptcha: controls the bot-check result (true=pass, false=fail)
const mockVerifyRecaptcha = vi.fn();

// Builds a fake Drizzle DB instance that returns selectData rows in order
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

describe("POST /api/book/guest-request", () => {
  let POST: (request: Request) => Promise<Response>;

  // Reset all mock call counts, clear the stateful select counter, and set
  // default happy-path mock behaviors before each test
  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockVerifyRecaptcha.mockResolvedValue(true);
    mockResendSend.mockResolvedValue({ id: "email-id" });

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      profiles: { id: "id", email: "email", firstName: "firstName", role: "role" },
      services: { id: "id", name: "name", priceInCents: "priceInCents" },
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

    const mod = await import("./route");
    POST = mod.POST;
  });

  function makePost(body: unknown) {
    return new Request("https://example.com/api/book/guest-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /* ---------- Validation ---------- */

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("https://example.com/api/book/guest-request", {
      method: "POST",
      body: "not json {{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makePost({ email: "a@b.com", serviceId: "1", preferredDate: "Mon" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makePost({ email: "a@b.com", serviceId: "1", preferredDate: "Mon", name: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when reCAPTCHA verification fails", async () => {
    mockVerifyRecaptcha.mockResolvedValueOnce(false);
    const res = await POST(
      makePost({ name: "Alice", email: "a@b.com", serviceId: "1", preferredDate: "Mon" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(
      makePost({ name: "Alice", email: "notanemail", serviceId: "1", preferredDate: "Mon" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when service does not exist", async () => {
    selectData[0] = []; // service not found
    const res = await POST(
      makePost({ name: "Alice", email: "a@b.com", serviceId: "999", preferredDate: "Mon" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and emails admin on happy path", async () => {
    selectData[0] = [{ name: "Haircut", priceInCents: 5000 }]; // service
    selectData[1] = [{ email: "admin@studio.com", firstName: "Studio" }]; // admin

    const res = await POST(
      makePost({
        name: "Alice",
        email: "alice@example.com",
        serviceId: "1",
        preferredDate: "Next Monday",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockResendSend).toHaveBeenCalledOnce();
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@studio.com",
        replyTo: "alice@example.com",
        subject: expect.stringContaining("Haircut"),
      }),
    );
  });

  it("returns 200 even when no admin exists (skips email silently)", async () => {
    selectData[0] = [{ name: "Haircut", priceInCents: 5000 }];
    selectData[1] = []; // no admin

    const res = await POST(
      makePost({ name: "Alice", email: "a@b.com", serviceId: "1", preferredDate: "Mon" }),
    );

    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("includes reference photos in the email when provided", async () => {
    selectData[0] = [{ name: "Color", priceInCents: 15000 }];
    selectData[1] = [{ email: "admin@studio.com", firstName: "Studio" }];

    await POST(
      makePost({
        name: "Alice",
        email: "a@b.com",
        serviceId: "1",
        preferredDate: "Fri",
        referencePhotoUrls: ["https://cdn.example.com/photo1.jpg"],
      }),
    );

    const htmlArg = mockResendSend.mock.calls[0][0].html as string;
    expect(htmlArg).toContain("photo1.jpg");
  });
});
