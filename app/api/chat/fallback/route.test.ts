/**
 * Tests for POST /api/chat/fallback — chatbot "Something else?" handler.
 *
 * Covers:
 *  - Input validation: invalid JSON, missing name/email/question,
 *    invalid email format
 *  - reCAPTCHA bot-check failure (403)
 *  - Happy path: admin found → sends email with question, replyTo set
 *    to the visitor's address so admin can reply directly
 *  - Graceful degradation: no admin profile → 200 without sending email
 *
 * Mocks: db (select chain), Resend email sender, reCAPTCHA verifier.
 * No auth — endpoint is fully public.
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
// mockResendSend: captures Resend SDK emails.send() calls
const mockResendSend = vi.fn();
// mockVerifyRecaptcha: controls the reCAPTCHA bot-check result
const mockVerifyRecaptcha = vi.fn();

function buildDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++;
      const rows = selectData[idx] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi
        .fn()
        .mockReturnValue(Object.assign([...rows], { limit: vi.fn().mockReturnValue(rows) }));
      chain.limit = vi.fn().mockReturnValue(rows);
      return chain;
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("POST /api/chat/fallback", () => {
  let POST: (request: Request) => Promise<Response>;

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
    return new Request("https://example.com/api/chat/fallback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /* ---------- Validation ---------- */

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("https://example.com/api/chat/fallback", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePost({ email: "a@b.com", question: "What are your hours?" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Missing") });
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makePost({ name: "Alice", question: "Do you do nails?" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when question is missing", async () => {
    const res = await POST(makePost({ name: "Alice", email: "a@b.com", question: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(makePost({ name: "Alice", email: "notanemail", question: "Hours?" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when reCAPTCHA fails", async () => {
    mockVerifyRecaptcha.mockResolvedValueOnce(false);
    const res = await POST(
      makePost({ name: "Alice", email: "a@b.com", question: "Do you do highlights?" }),
    );
    expect(res.status).toBe(403);
  });

  /* ---------- Happy path ---------- */

  it("emails admin and returns 200", async () => {
    selectData[0] = [{ email: "admin@studio.com", firstName: "Studio" }];

    const res = await POST(
      makePost({ name: "Alice", email: "alice@example.com", question: "Do you do balayage?" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockResendSend).toHaveBeenCalledOnce();
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@studio.com",
        replyTo: "alice@example.com",
        subject: expect.stringContaining("Alice"),
      }),
    );
  });

  it("returns 200 silently when no admin found", async () => {
    selectData[0] = []; // no admin

    const res = await POST(
      makePost({ name: "Alice", email: "a@b.com", question: "Do you do lashes?" }),
    );

    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
