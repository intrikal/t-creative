/**
 * Tests for GET /api/cron/review-requests — post-booking review email sender.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - No-op: no completed bookings in the window → zero counts
 *  - Happy path: eligible booking → sends review request email with correct
 *    entityType and localId for dedup
 *  - Failure counting: sendEmail returns false → increments failed counter
 *  - Deduplication: existing sync_log entry → skips sending
 *  - Preference checks: notifyEmail=false or null clientEmail → skips silently
 *
 * Mocks: db (select chain), sendEmail, ReviewRequest component,
 * settings-actions (remindersConfig for delay hours).
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
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/review-requests", () => {
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
      bookings: {
        id: "id",
        clientId: "clientId",
        status: "status",
        completedAt: "completedAt",
        serviceId: "serviceId",
      },
      profiles: {
        id: "id",
        email: "email",
        firstName: "firstName",
        notifyEmail: "notifyEmail",
      },
      services: { id: "id", name: "name" },
      syncLog: {
        id: "id",
        entityType: "entityType",
        localId: "localId",
        status: "status",
      },
    }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/ReviewRequest", () => ({
      ReviewRequest: vi.fn().mockReturnValue(null),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/review-requests", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 without x-cron-secret header", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeGet("wrong"));
    expect(res.status).toBe(401);
  });

  /* ---------- No-op ---------- */

  it("returns zero counts when no completed bookings are in the window", async () => {
    selectData[0] = [];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: 0, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------- Happy path ---------- */

  it("sends a review request email for eligible bookings", async () => {
    selectData[0] = [
      {
        bookingId: 42,
        clientId: "c1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Haircut",
      },
    ];
    selectData[1] = []; // no existing dedup entry

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matched: 1, sent: 1, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "review_request",
        localId: "42",
      }),
    );
  });

  it("counts failed sends correctly", async () => {
    selectData[0] = [
      {
        bookingId: 5,
        clientId: "c1",
        clientEmail: "x@y.com",
        clientFirstName: "X",
        notifyEmail: true,
        serviceName: "Color",
      },
    ];
    selectData[1] = [];
    mockSendEmail.mockResolvedValueOnce(false);

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ matched: 1, sent: 0, failed: 1 });
  });

  /* ---------- Deduplication ---------- */

  it("skips bookings that already have a review request sent", async () => {
    selectData[0] = [
      {
        bookingId: 99,
        clientId: "c1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Haircut",
      },
    ];
    selectData[1] = [{ id: 55 }]; // existing sync_log → already sent

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ matched: 1, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips bookings where notifyEmail is false", async () => {
    selectData[0] = [
      {
        bookingId: 10,
        clientId: "c1",
        clientEmail: "x@y.com",
        clientFirstName: "X",
        notifyEmail: false,
        serviceName: "Cut",
      },
    ];

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ matched: 1, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips bookings with no client email", async () => {
    selectData[0] = [
      {
        bookingId: 11,
        clientId: "c1",
        clientEmail: null,
        clientFirstName: "X",
        notifyEmail: true,
        serviceName: "Cut",
      },
    ];

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ matched: 1, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
