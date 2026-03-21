/**
 * Tests for GET /api/cron/fill-reminders — lash fill reminder email sender.
 *
 * Covers:
 *  - Auth: missing or wrong CRON_SECRET returns 401
 *  - Core sending: eligible client (completed lash booking 18 days ago,
 *    notifyEmail + notifyMarketing enabled) receives fill reminder email
 *  - Counts: two eligible candidates → sent=2, matched=2
 *  - Dedup (sync_log): existing reminder entry → skipped, no email sent
 *  - Preference checks: notifyEmail=false → skipped; notifyMarketing=false → skipped
 *  - Upcoming booking check: client already has a future lash booking → skipped
 *  - Rebooking URL: email includes one-click link with service ID pre-filled
 *  - Mixed results: first send succeeds, second fails → sent=1, failed=1
 *
 * The route performs 6 sequential queries per candidate (candidates,
 * admin profile, sync_log dedup, upcoming lash check, booking history
 * for pattern analysis, staff name lookup). The setupDbMock helper
 * configures a stateful mock that routes each db.select() call to the
 * correct return value based on invocation order.
 *
 * Mocks: db (stateful select chain factory), sendEmail, FillReminder
 * component, settings-actions (remindersConfig), Sentry.
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn();
const mockSelectInner = vi.fn();

vi.mock("@/lib/resend", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/emails/FillReminder", () => ({
  FillReminder: vi.fn(() => null),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// We use a configurable db mock that can be swapped per test via vi.doMock
// The top-level mock is only a placeholder; each test re-imports the module.

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRequest(secret: string | null = "test-cron-secret"): Request {
  const headers: Record<string, string> = {};
  if (secret !== null) headers["x-cron-secret"] = secret;
  return new Request("https://example.com/api/cron/fill-reminders", {
    method: "GET",
    headers,
  });
}

/** Build a candidate row as returned by the candidates query. */
function makeCandidate(overrides: Record<string, unknown> = {}) {
  const daysAgo18 = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 60_000);
  return {
    bookingId: 1,
    clientId: "client-1",
    startsAt: daysAgo18,
    serviceId: "svc-1",
    serviceName: "Classic Full Set",
    staffId: "staff-1",
    clientEmail: "client@example.com",
    clientFirstName: "Alice",
    notifyEmail: true,
    notifyMarketing: true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/fill-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://tcreativestudio.com";
  });

  /* ---------- Auth ---------- */

  it("returns 401 when CRON_SECRET header is missing", async () => {
    vi.resetModules();
    setupDbMock({ candidates: [] });
    const { GET } = await import("./route");
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET header is wrong", async () => {
    vi.resetModules();
    setupDbMock({ candidates: [] });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  /* ---------- Core sending logic ---------- */

  it("sends fill reminder emails to eligible clients", async () => {
    vi.resetModules();
    const candidate = makeCandidate();
    setupDbMock({ candidates: [candidate] });
    mockSendEmail.mockResolvedValue(true);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [params] = mockSendEmail.mock.calls[0] as [
      { to: string; subject: string; entityType: string; localId: string },
    ];
    expect(params.to).toBe("client@example.com");
    expect(params.entityType).toBe("fill_reminder");
    expect(params.localId).toBe("1");
  });

  it("returns count of reminders sent", async () => {
    vi.resetModules();
    const candidates = [makeCandidate({ bookingId: 10 }), makeCandidate({ bookingId: 11 })];
    setupDbMock({ candidates });
    mockSendEmail.mockResolvedValue(true);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(body.matched).toBe(2);
  });

  /* ---------- Skipping logic ---------- */

  it("skips clients who already received a reminder (idempotent via sync_log)", async () => {
    vi.resetModules();
    const candidate = makeCandidate({ bookingId: 42 });
    // existingSyncLog returns a record for this bookingId
    setupDbMock({ candidates: [candidate], existingReminder: true });
    mockSendEmail.mockResolvedValue(true);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });

  it("skips clients with notifyEmail preference disabled", async () => {
    vi.resetModules();
    const candidate = makeCandidate({ notifyEmail: false });
    setupDbMock({ candidates: [candidate] });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });

  it("skips clients with notifyMarketing preference disabled", async () => {
    vi.resetModules();
    const candidate = makeCandidate({ notifyMarketing: false });
    setupDbMock({ candidates: [candidate] });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });

  it("skips clients who already have an upcoming lash booking", async () => {
    vi.resetModules();
    const candidate = makeCandidate({ bookingId: 55 });
    setupDbMock({ candidates: [candidate], hasUpcomingLash: true });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });

  /* ---------- Rebooking URL ---------- */

  it("includes one-click rebooking link with service pre-filled in email", async () => {
    vi.resetModules();
    const candidate = makeCandidate({ serviceId: "svc-classic" });
    setupDbMock({ candidates: [candidate], studioName: "T Creative" });
    mockSendEmail.mockResolvedValue(true);

    const { GET } = await import("./route");
    await GET(makeRequest());

    // FillReminder should be called with a bookingUrl containing the service id
    const { FillReminder } = await import("@/emails/FillReminder");
    const fillReminderCalls = (FillReminder as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillReminderCalls.length).toBeGreaterThan(0);
    const [props] = fillReminderCalls[0] as [{ bookingUrl: string; serviceName: string }];
    expect(props.bookingUrl).toContain("svc-classic");
  });

  /* ---------- Mixed results ---------- */

  it("tracks sent vs failed counts correctly", async () => {
    vi.resetModules();
    const candidates = [
      makeCandidate({ bookingId: 1, clientEmail: "a@example.com" }),
      makeCandidate({ bookingId: 2, clientEmail: "b@example.com" }),
    ];
    setupDbMock({ candidates });
    // First succeeds, second fails
    mockSendEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  DB mock factory                                                    */
/* ------------------------------------------------------------------ */

/**
 * Sets up a vi.doMock for @/db and @/db/schema that supports the
 * query patterns used in fill-reminders route.
 *
 * The route executes these queries (in order, per candidate):
 *   1. candidates: joined select (bookings × profiles × services)
 *   2. adminProfile: single admin row
 *   3. existing sync_log: idempotency check per candidate
 *   4. upcomingLash: future lash booking check per candidate
 *   5. history: last 10 bookings for pattern analysis
 *   6. staffRow: staff first name lookup
 */
function setupDbMock(opts: {
  candidates?: ReturnType<typeof makeCandidate>[];
  existingReminder?: boolean;
  hasUpcomingLash?: boolean;
  studioName?: string;
}) {
  const {
    candidates = [],
    existingReminder = false,
    hasUpcomingLash = false,
    studioName = "T Creative",
  } = opts;

  /**
   * The route uses two query shapes:
   *   db.select().from().where()           — returns array
   *   db.select().from().where().limit()   — returns array (limit is chained)
   *   db.select().from().innerJoin().innerJoin().where() — candidates query
   *   db.select().from().where().limit()   — admin profile, sync_log, upcoming
   *   db.select().from().innerJoin().where().orderBy().limit() — history
   */

  let candidatesServed = false;
  let adminServed = false;

  // Per-candidate call state (reset for each new candidate)
  // We track invocations post-candidates to route to the right query
  let perCandidateCallCount = 0;

  const makeChain = (returnValue: unknown) => ({
    where: (..._args: unknown[]) => ({
      limit: () => (Array.isArray(returnValue) ? returnValue : [returnValue]),
      orderBy: () => ({
        limit: () => (Array.isArray(returnValue) ? returnValue : [returnValue]),
      }),
      // Spread to allow direct array return (for sync checks)
      then: undefined,
      [Symbol.iterator]: (Array.isArray(returnValue) ? returnValue : [returnValue])[
        Symbol.iterator
      ].bind(Array.isArray(returnValue) ? returnValue : [returnValue]),
    }),
    innerJoin: (..._args: unknown[]) => ({
      where: (..._args2: unknown[]) => ({
        limit: () => (Array.isArray(returnValue) ? returnValue : [returnValue]),
        orderBy: () => ({
          limit: () => (Array.isArray(returnValue) ? returnValue : [returnValue]),
        }),
      }),
      innerJoin: () => ({
        where: () => (Array.isArray(returnValue) ? returnValue : [returnValue]),
      }),
    }),
    limit: () => (Array.isArray(returnValue) ? returnValue : [returnValue]),
  });

  const dbMock = {
    select: (..._selectArgs: unknown[]) => ({
      from: (..._fromArgs: unknown[]) => {
        // Candidates query comes first (has two innerJoins, returns array directly)
        if (!candidatesServed) {
          candidatesServed = true;
          return {
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => candidates,
              }),
            }),
            where: () => ({
              limit: () => [],
            }),
          };
        }

        // Admin profile query (second global select)
        if (!adminServed) {
          adminServed = true;
          return {
            where: () => ({
              limit: () => [{ onboardingData: { studioName } }],
            }),
          };
        }

        // Per-candidate queries (cycle: sync_log check → upcoming lash → history → staff)
        perCandidateCallCount++;
        const cyclePos = ((perCandidateCallCount - 1) % 4) + 1;

        if (cyclePos === 1) {
          // sync_log idempotency check
          const existing = existingReminder ? [{ id: 99 }] : [];
          return makeChain(existing);
        }
        if (cyclePos === 2) {
          // upcoming lash check
          const upcoming = hasUpcomingLash ? [{ id: 50 }] : [];
          return makeChain(upcoming);
        }
        if (cyclePos === 3) {
          // history (last 10 lash bookings)
          return {
            from: () => makeChain([]),
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({ limit: () => [] }),
              }),
            }),
          };
        }
        // cyclePos === 4: staff name lookup
        return makeChain([{ firstName: "Mia" }]);
      },
    }),
  };

  vi.doMock("@/db", () => ({ db: dbMock }));

  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      startsAt: "startsAt",
      status: "status",
    },
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      role: "role",
      onboardingData: "onboardingData",
      notifyEmail: "notifyEmail",
      notifyMarketing: "notifyMarketing",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
    },
    syncLog: {
      id: "id",
      entityType: "entityType",
      localId: "localId",
      status: "status",
    },
  }));
}
