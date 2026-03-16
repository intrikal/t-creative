import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];
const mockSendEmail = vi.fn();

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

describe("GET /api/cron/birthdays", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockSendEmail.mockResolvedValue(true);
    process.env.CRON_SECRET = "test-secret";

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      profiles: {
        id: "id",
        email: "email",
        firstName: "firstName",
        isActive: "isActive",
        notifyEmail: "notifyEmail",
        onboardingData: "onboardingData",
      },
      syncLog: {
        id: "id",
        entityType: "entityType",
        localId: "localId",
        status: "status",
        createdAt: "createdAt",
      },
    }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/BirthdayGreeting", () => ({
      BirthdayGreeting: vi.fn().mockReturnValue(null),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/birthdays", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 without x-cron-secret header", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const res = await GET(makeGet("wrong"));
    expect(res.status).toBe(401);
  });

  /* ---------- No-op ---------- */

  it("returns zero counts when no birthday profiles match", async () => {
    selectData[0] = []; // no profiles with today's birthday

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: 0, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------- Happy path ---------- */

  it("sends a birthday email and counts correctly", async () => {
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    selectData[1] = []; // no existing sync_log entry → send email

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 1, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "birthday_greeting",
        localId: "p1",
      }),
    );
  });

  it("counts failed sends correctly when sendEmail returns false", async () => {
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    selectData[1] = [];
    mockSendEmail.mockResolvedValueOnce(false);

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 1 });
  });

  /* ---------- Deduplication ---------- */

  it("skips profile already sent a birthday email this year", async () => {
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    selectData[1] = [{ id: 99 }]; // existing sync_log → already sent

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips profiles with no email address", async () => {
    selectData[0] = [{ id: "p2", email: null, firstName: "Bob" }];
    // no second select call expected (early continue)

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("processes multiple profiles independently", async () => {
    selectData[0] = [
      { id: "p1", email: "alice@example.com", firstName: "Alice" },
      { id: "p2", email: "bob@example.com", firstName: "Bob" },
    ];
    selectData[1] = []; // Alice: no dedup → send
    selectData[2] = [{ id: 55 }]; // Bob: already sent → skip

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 2, sent: 1, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });
});
