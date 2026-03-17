import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSendEmail = vi.fn();

function buildDb() {
  const insertReturning = vi.fn().mockResolvedValue([{ id: 99 }]);
  const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });

  mockInsert.mockReturnValue({ values: insertValues });

  const updateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  mockUpdate.mockReturnValue({ set: updateSet });

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
    insert: mockInsert,
    update: mockUpdate,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/recurring-bookings", () => {
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
        serviceId: "serviceId",
        staffId: "staffId",
        startsAt: "startsAt",
        durationMinutes: "durationMinutes",
        totalInCents: "totalInCents",
        location: "location",
        recurrenceRule: "recurrenceRule",
        parentBookingId: "parentBookingId",
        subscriptionId: "subscriptionId",
        completedAt: "completedAt",
        status: "status",
        deletedAt: "deletedAt",
        confirmedAt: "confirmedAt",
      },
      bookingSubscriptions: {
        id: "id",
        sessionsUsed: "sessionsUsed",
        totalSessions: "totalSessions",
        status: "status",
        intervalDays: "intervalDays",
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
    vi.doMock("@/emails/RecurringBookingConfirmation", () => ({
      RecurringBookingConfirmation: vi.fn().mockReturnValue(null),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/recurring-bookings", {
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

  it("returns zero counts when no completed recurring bookings exist", async () => {
    // candidates query returns empty
    selectData[0] = [];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 0, created: 0, skipped: 0 });
  });

  /* ---------- Happy path: RRULE ---------- */

  it("creates next booking for completed recurring booking with RRULE", async () => {
    const completedBooking = {
      id: 10,
      clientId: "client-1",
      serviceId: 1,
      staffId: "staff-1",
      startsAt: new Date("2026-03-01T10:00:00Z"),
      durationMinutes: 90,
      totalInCents: 12000,
      location: "Studio",
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=2",
      parentBookingId: null,
      subscriptionId: null,
      completedAt: new Date(),
    };

    // 0: candidates
    selectData[0] = [completedBooking];
    // 1: existing successors (none)
    selectData[1] = [];
    // 2: sync_log dedup (none processed)
    selectData[2] = [];
    // 3: email lookup for confirmation
    selectData[3] = [
      {
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
      },
    ];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.checked).toBe(1);
    expect(body.created).toBe(1);
  });

  /* ---------- Dedup: successor exists ---------- */

  it("skips booking when successor already exists in the series", async () => {
    const completedBooking = {
      id: 10,
      clientId: "client-1",
      serviceId: 1,
      staffId: "staff-1",
      startsAt: new Date("2026-03-01T10:00:00Z"),
      durationMinutes: 90,
      totalInCents: 12000,
      location: "Studio",
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=2",
      parentBookingId: null,
      subscriptionId: null,
      completedAt: new Date(),
    };

    // 0: candidates
    selectData[0] = [completedBooking];
    // 1: existing successors — one exists with later date
    selectData[1] = [{ parentBookingId: 10, startsAt: new Date("2026-03-15T10:00:00Z") }];
    // 2: sync_log dedup (none processed)
    selectData[2] = [];

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(1);
  });

  /* ---------- Dedup: already processed ---------- */

  it("skips booking already processed by this cron", async () => {
    const completedBooking = {
      id: 10,
      clientId: "client-1",
      serviceId: 1,
      staffId: null,
      startsAt: new Date("2026-03-01T10:00:00Z"),
      durationMinutes: 60,
      totalInCents: 8000,
      location: null,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=3",
      parentBookingId: null,
      subscriptionId: null,
      completedAt: new Date(),
    };

    // 0: candidates
    selectData[0] = [completedBooking];
    // 1: existing successors
    selectData[1] = [];
    // 2: sync_log dedup — already processed
    selectData[2] = [{ localId: "10" }];

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(1);
  });
});
