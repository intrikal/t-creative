/**
 * Tests for GET /api/cron/booking-reminders — 24h/48h reminder sender.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - No-op: no bookings in any reminder window → zero counts, no sends
 *  - Happy path: booking with both email + SMS prefs → sends both (sent: 2)
 *  - Partial prefs: notifySms=false → email only; notifyEmail=false → SMS only
 *  - Deduplication: existing sync_log entry for email or SMS → skips that channel
 *  - Failure counting: sendEmail returns false → increments failed counter
 *
 * Mocks: db (select chain), sendEmail, sendSms, BookingReminder component,
 * settings-actions (remindersConfig, businessProfile).
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
// mockSendEmail: captures email send calls via the Resend wrapper
const mockSendEmail = vi.fn();
// mockSendSms: captures SMS send calls via the Twilio wrapper
const mockSendSms = vi.fn();

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

/** A booking record shaped the way the route expects from the join query. */
function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: 1,
    clientId: "client-1",
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
    durationMinutes: 60,
    totalInCents: 8000,
    location: "Studio",
    clientEmail: "alice@example.com",
    clientPhone: "+15550001234",
    clientFirstName: "Alice",
    notifyEmail: true,
    notifySms: true,
    serviceName: "Haircut",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/booking-reminders", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockSendEmail.mockResolvedValue(true);
    mockSendSms.mockResolvedValue(true);
    process.env.CRON_SECRET = "test-secret";

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      bookings: {
        id: "id",
        clientId: "clientId",
        startsAt: "startsAt",
        durationMinutes: "durationMinutes",
        totalInCents: "totalInCents",
        location: "location",
        status: "status",
        serviceId: "serviceId",
      },
      profiles: {
        id: "id",
        email: "email",
        phone: "phone",
        firstName: "firstName",
        notifyEmail: "notifyEmail",
        notifySms: "notifySms",
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
    vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
    vi.doMock("@/emails/BookingReminder", () => ({
      BookingReminder: vi.fn().mockReturnValue(null),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/booking-reminders", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 without x-cron-secret header", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeGet("bad"));
    expect(res.status).toBe(401);
  });

  /* ---------- No-op ---------- */

  it("returns zero counts when no bookings fall in any reminder window", async () => {
    // Two windows (24h, 48h) — both return empty
    selectData[0] = [];
    selectData[1] = [];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  /* ---------- Happy path ---------- */

  it("sends email and SMS for a booking with both preferences enabled", async () => {
    // 24h window: one booking
    selectData[0] = [makeBooking()];
    selectData[1] = []; // email: no dedup
    selectData[2] = []; // SMS: no dedup
    // 48h window: empty
    selectData[3] = [];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 2, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  it("sends only email when notifySms is false", async () => {
    selectData[0] = [makeBooking({ notifySms: false })];
    selectData[1] = []; // email dedup: not sent
    // No SMS dedup check
    selectData[2] = []; // 48h window

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("sends only SMS when notifyEmail is false", async () => {
    selectData[0] = [makeBooking({ notifyEmail: false })];
    selectData[1] = []; // SMS dedup: not sent
    selectData[2] = []; // 48h window

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  /* ---------- Deduplication ---------- */

  it("skips email already sent (dedup check finds existing sync_log)", async () => {
    selectData[0] = [makeBooking({ notifySms: false })];
    selectData[1] = [{ id: 10 }]; // email already sent
    selectData[2] = []; // 48h window

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips SMS already sent (dedup check finds existing sync_log)", async () => {
    selectData[0] = [makeBooking({ notifyEmail: false })];
    selectData[1] = [{ id: 11 }]; // SMS already sent
    selectData[2] = []; // 48h window

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ sent: 0, failed: 0 });
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("counts send failures correctly", async () => {
    selectData[0] = [makeBooking({ notifySms: false })];
    selectData[1] = [];
    selectData[2] = [];
    mockSendEmail.mockResolvedValueOnce(false);

    const res = await GET(makeGet("test-secret"));
    expect(await res.json()).toEqual({ sent: 0, failed: 1 });
  });
});
