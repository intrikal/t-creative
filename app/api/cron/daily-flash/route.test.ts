/**
 * Tests for GET /api/cron/daily-flash — morning flash report email to admin.
 *
 * Covers:
 *  - Auth: missing or wrong CRON_SECRET returns 401
 *  - Happy path: rich data scenario with revenue ($250), 1 appointment,
 *    1 overnight cancellation, 3 inquiries → sends email, returns all counts
 *  - Zero-booking day: all queries return zero/empty → still sends email
 *    (admin should know it was a quiet day), all counts are 0
 *  - No admin email: admin query returns empty → 500 with "No admin email found",
 *    no email sent
 *
 * The route fires 9 parallel DB queries via Promise.all (revenue, today's
 * bookings, cancellations, inquiries, 3 waitlist queries, unpaid invoices,
 * admin). Each query chain is thenable so Promise.all can resolve it.
 *
 * Mocks: db (thenable select chains for 9 parallel queries), sendEmail,
 * DailyFlashReport component, drizzle-orm operators, date-fns format.
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

let selectCallCount = 0;
const mockSendEmail = vi.fn();

/**
 * Build a thenable chain for a single db.select() call.
 *
 * The route uses Promise.all over 9 queries. Several of them call .then()
 * directly on the chain to transform the raw rows before Promise.all collects
 * them. We therefore make every chain thenable: its `.then()` resolves with
 * the configured `resolveValue` so that both direct-await and Promise.all work.
 *
 * Queries that do NOT call .then() (queries 1 and 2 — todayBookings and
 * cancellations) must resolve with arrays directly, since Promise.all awaits
 * the chain itself.
 */
const createChain = (resolveValue: unknown) => {
  const chain: Record<string, Function> = {};
  const methods = ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "limit"];
  for (const m of methods) chain[m] = (..._: unknown[]) => chain;
  chain.then = (fn: Function) => Promise.resolve(fn(resolveValue));
  return chain;
};

/**
 * Default resolve values for the 9 parallel queries, in the order they appear
 * in the route's Promise.all:
 *   0 — revenueRow       .then((r) => r[0])          → needs array: [{ total }]
 *   1 — todayBookings    awaited directly             → []
 *   2 — cancellations    awaited directly             → []
 *   3 — newInquiryCount  .then((r) => Number(r[0].count))  → [{ count: 0 }]
 *   4 — waitlistAdded    .then((r) => Number(r[0].count))  → [{ count: 0 }]
 *   5 — waitlistClaimed  .then((r) => Number(r[0].count))  → [{ count: 0 }]
 *   6 — waitlistExpired  .then((r) => Number(r[0].count))  → [{ count: 0 }]
 *   7 — unpaidInvoices   .then((r) => r[0])          → needs array: [{ count, total }]
 *   8 — adminRow         .then((r) => r[0])          → needs array: [{ email, firstName }]
 */
const defaultResolves: unknown[] = [
  [{ total: 0 }],                                                   // 0: revenue
  [],                                                               // 1: today's bookings
  [],                                                               // 2: cancellations
  [{ count: 0 }],                                                   // 3: new inquiries
  [{ count: 0 }],                                                   // 4: waitlist added
  [{ count: 0 }],                                                   // 5: waitlist claimed
  [{ count: 0 }],                                                   // 6: waitlist expired
  [{ count: 0, total: 0 }],                                         // 7: unpaid invoices
  [{ email: "admin@example.com", firstName: "Admin" }],             // 8: admin
];

function buildDb(overrides: Record<number, unknown> = {}) {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallCount++;
      const resolveValue = idx in overrides ? overrides[idx] : defaultResolves[idx];
      return createChain(resolveValue);
    }),
  };
}

/** Common schema mock used by all tests. */
const schemaMock = {
  bookings: {
    id: "id",
    clientId: "clientId",
    serviceId: "serviceId",
    startsAt: "startsAt",
    status: "status",
    cancelledAt: "cancelledAt",
  },
  payments: {
    id: "id",
    amountInCents: "amountInCents",
    status: "status",
    paidAt: "paidAt",
  },
  services: { id: "id", name: "name" },
  profiles: {
    id: "id",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    role: "role",
  },
  inquiries: { id: "id", status: "status", createdAt: "createdAt" },
  waitlist: {
    id: "id",
    status: "status",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
};

/** Common drizzle-orm mock used by all tests. */
const drizzleMock = {
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  gte: (...args: unknown[]) => args,
  lt: (...args: unknown[]) => args,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc: string, s: string, i: number) => acc + s + (values[i] ?? ""), ""),
};

/** Common date-fns mock used by all tests. */
const dateFnsMock = {
  format: (_date: unknown, _fmt: string) => "Tuesday, March 17, 2026",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/daily-flash", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectCallCount = 0;
    mockSendEmail.mockResolvedValue(true);
    process.env.CRON_SECRET = "test-secret";

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => schemaMock);
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/DailyFlashReport", () => ({
      DailyFlashReport: vi.fn().mockReturnValue("email-component"),
    }));
    vi.doMock("drizzle-orm", () => drizzleMock);
    vi.doMock("date-fns", () => dateFnsMock);

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/daily-flash", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 when CRON_SECRET is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const res = await GET(makeGet("bad-secret"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  /* ---------- Happy path ---------- */

  it("sends email with yesterday's stats", async () => {
    vi.resetModules();
    selectCallCount = 0;

    const todayBookingsData = [
      {
        startsAt: new Date("2026-03-17T10:00:00Z"),
        clientFirstName: "Alice",
        clientLastName: "Smith",
        serviceName: "Haircut",
      },
    ];
    const cancellationsData = [
      {
        clientFirstName: "Bob",
        clientLastName: "Jones",
        serviceName: "Color",
        startsAt: new Date("2026-03-17T14:00:00Z"),
      },
    ];

    const richResolves: unknown[] = [
      [{ total: 25000 }],                                           // 0: revenue → $250
      todayBookingsData,                                            // 1: today's bookings
      cancellationsData,                                            // 2: cancellations
      [{ count: 3 }],                                               // 3: new inquiries
      [{ count: 2 }],                                               // 4: waitlist added
      [{ count: 1 }],                                               // 5: waitlist claimed
      [{ count: 0 }],                                               // 6: waitlist expired
      [{ count: 4, total: 80000 }],                                 // 7: unpaid invoices
      [{ email: "admin@example.com", firstName: "Admin" }],         // 8: admin
    ];

    vi.doMock("@/db", () => ({
      db: {
        select: vi.fn().mockImplementation(() => {
          const idx = selectCallCount++;
          return createChain(richResolves[idx]);
        }),
      },
    }));
    vi.doMock("@/db/schema", () => schemaMock);
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/DailyFlashReport", () => ({
      DailyFlashReport: vi.fn().mockReturnValue("email-component"),
    }));
    vi.doMock("drizzle-orm", () => drizzleMock);
    vi.doMock("date-fns", () => dateFnsMock);

    const mod = await import("./route");
    const richGET = mod.GET;

    const res = await richGET(makeGet("test-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(body.yesterdayRevenue).toBe(250); // 25000 cents → $250
    expect(body.todayAppointments).toBe(1);
    expect(body.cancellations).toBe(1);
    expect(body.inquiries).toBe(3);

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        entityType: "daily_flash_report",
      }),
    );
  });

  /* ---------- Zero-booking day ---------- */

  it("handles zero-booking day gracefully and still sends email", async () => {
    // All defaults produce zero counts — verify it completes with sent: true
    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(body.yesterdayRevenue).toBe(0);
    expect(body.todayAppointments).toBe(0);
    expect(body.cancellations).toBe(0);
    expect(body.inquiries).toBe(0);

    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  /* ---------- No admin email ---------- */

  it("returns 500 when no admin email found", async () => {
    vi.resetModules();
    selectCallCount = 0;

    // Slot 8 (admin query) returns an empty array so r[0] is undefined,
    // which satisfies the route's `!adminRow?.email` guard → 500.
    const noAdminResolves: unknown[] = [
      ...defaultResolves.slice(0, 8),
      [], // 8: admin query returns no rows → r[0] === undefined
    ];

    vi.doMock("@/db", () => ({
      db: {
        select: vi.fn().mockImplementation(() => {
          const idx = selectCallCount++;
          return createChain(noAdminResolves[idx]);
        }),
      },
    }));
    vi.doMock("@/db/schema", () => schemaMock);
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/DailyFlashReport", () => ({
      DailyFlashReport: vi.fn().mockReturnValue("email-component"),
    }));
    vi.doMock("drizzle-orm", () => drizzleMock);
    vi.doMock("date-fns", () => dateFnsMock);

    const mod = await import("./route");
    const noAdminGET = mod.GET;

    const res = await noAdminGET(makeGet("test-secret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "No admin email found" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
