import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];
const mockResendSend = vi.fn();
const mockVerifyTurnstile = vi.fn();

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
    mockVerifyTurnstile.mockResolvedValue(true);
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
    vi.doMock("@/lib/turnstile", () => ({ verifyTurnstileToken: mockVerifyTurnstile }));
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

  it("returns 403 when turnstile fails", async () => {
    mockVerifyTurnstile.mockResolvedValueOnce(false);
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
