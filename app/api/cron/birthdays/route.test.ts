/**
 * Tests for GET /api/cron/birthdays — birthday greeting email with promo code.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - No-op: no profiles with today's birthday → zero counts, no email sent
 *  - Happy path: one birthday profile → generates BDAY-xxxx promo code,
 *    inserts promotion row, sends birthday greeting email with 10% discount,
 *    returns matched=1, sent=1
 *  - Default discount: no settings row → falls back to 5% discount
 *  - Failure counting: sendEmail returns false → sent=0, failed=1
 *  - Deduplication: existing sync_log entry for this profile+year → skipped
 *  - Null email: profile with no email → skipped silently
 *  - Multiple profiles: two birthday profiles, second already sent →
 *    processes first (sent=1), skips second
 *
 * Mocks: db (select/insert chains), sendEmail, BirthdayGreeting component,
 * settings-actions (loyaltyConfig, businessProfile).
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

let selectIdx = 0;
let selectData: unknown[][] = [];
const mockSendEmail = vi.fn();
const mockInsert = vi.fn();

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
    insert: vi.fn().mockImplementation(() => ({
      values: mockInsert.mockReturnValue(undefined),
    })),
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
    mockInsert.mockReturnValue(undefined);
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
      promotions: {
        id: "id",
        code: "code",
      },
      settings: {
        key: "key",
        value: "value",
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
    // select[0]: no profiles with today's birthday
    selectData[0] = [];
    // select[1]: settings query (birthday discount)
    selectData[1] = [{ value: { birthdayDiscountPercent: 5 } }];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: 0, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------- Happy path ---------- */

  it("sends a birthday email with promo code and counts correctly", async () => {
    // select[0]: birthday profiles
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    // select[1]: settings query
    selectData[1] = [{ value: { birthdayDiscountPercent: 10 } }];
    // select[2]: no existing sync_log entry → send email
    selectData[2] = [];
    // select[3]: promo code uniqueness check → no dup
    selectData[3] = [];

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

  it("uses default 5% discount when no settings exist", async () => {
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    // select[1]: no settings row → fallback to 5%
    selectData[1] = [];
    selectData[2] = [];
    selectData[3] = [];

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 1, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("5%"),
      }),
    );
  });

  it("counts failed sends correctly when sendEmail returns false", async () => {
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    selectData[1] = [{ value: { birthdayDiscountPercent: 5 } }];
    selectData[2] = [];
    selectData[3] = [];
    mockSendEmail.mockResolvedValueOnce(false);

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 1 });
  });

  /* ---------- Deduplication ---------- */

  it("skips profile already sent a birthday email this year", async () => {
    selectData[0] = [{ id: "p1", email: "alice@example.com", firstName: "Alice" }];
    selectData[1] = [{ value: { birthdayDiscountPercent: 5 } }];
    // select[2]: existing sync_log → already sent
    selectData[2] = [{ id: 99 }];

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips profiles with no email address", async () => {
    selectData[0] = [{ id: "p2", email: null, firstName: "Bob" }];
    selectData[1] = [{ value: { birthdayDiscountPercent: 5 } }];

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
    selectData[1] = [{ value: { birthdayDiscountPercent: 5 } }];
    selectData[2] = []; // Alice: no dedup → send
    selectData[3] = []; // Alice: promo uniqueness
    selectData[4] = [{ id: 55 }]; // Bob: already sent → skip

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ matched: 2, sent: 1, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });
});
