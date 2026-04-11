/**
 * Tests for GET /api/client-export — CCPA "Right to Know" data export.
 *
 * Covers:
 *  - Auth: unauthenticated → 401
 *  - Authorization: profile not found → 403; non-client role (admin) → 403
 *  - Happy path: authenticated client → 200 JSON download containing
 *    profile data, plus empty arrays for bookings, payments, orders,
 *    invoices, conversations, reviews, formSubmissions, serviceRecords,
 *    loyaltyTransactions, notifications, memberships, subscriptions,
 *    waitlistEntries, wishlistItems
 *  - Response headers: Content-Disposition attachment with dated filename,
 *    Cache-Control: no-store
 *  - Audit: logAction called with action="export", entityType="client_data"
 *
 * The route fires 15 parallel DB selects via Promise.all to gather all
 * client-related data in one request.
 *
 * Mocks: Supabase auth (getUser), db.select (thenable chain returning
 * profile on first call, empty arrays for all data queries), logAction,
 * Sentry, drizzle-orm operators.
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

const mockGetUser = vi.fn();
const mockLogAction = vi.fn();
const mockCaptureException = vi.fn();
const mockDbSelect = vi.fn();

/**
 * Returns a thenable chain that also supports limit/orderBy/leftJoin
 * terminals so the route's chained db calls resolve correctly.
 *
 * `result` is what the chain resolves to when awaited or consumed by
 * Promise.all.
 */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    orderBy: vi.fn().mockReturnValue(Promise.resolve(result)),
    limit: vi.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.leftJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

/** A realistic client profile returned by the profile lookup. */
const MOCK_PROFILE = {
  id: "user-123",
  role: "client",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@test.com",
  phone: "+15550001234",
  displayName: "Jane Doe",
  avatarUrl: null,
  isVip: false,
  lifecycleStage: "active",
  tags: [],
  source: null,
  notifySms: true,
  notifyEmail: true,
  notifyMarketing: false,
  referralCode: "JANE123",
  onboardingData: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
};

/* ------------------------------------------------------------------ */
/*  Static top-level mocks (replaced by vi.doMock inside beforeEach)   */
/* ------------------------------------------------------------------ */

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  profiles: { id: "id", role: "role" },
  clientPreferences: { profileId: "profileId" },
  bookings: {
    id: "id",
    clientId: "clientId",
    serviceId: "serviceId",
    status: "status",
    startsAt: "startsAt",
    durationMinutes: "durationMinutes",
    totalInCents: "totalInCents",
    discountInCents: "discountInCents",
    clientNotes: "clientNotes",
    location: "location",
    confirmedAt: "confirmedAt",
    completedAt: "completedAt",
    cancelledAt: "cancelledAt",
    cancellationReason: "cancellationReason",
    createdAt: "createdAt",
  },
  payments: {
    id: "id",
    clientId: "clientId",
    status: "status",
    method: "method",
    amountInCents: "amountInCents",
    tipInCents: "tipInCents",
    taxAmountInCents: "taxAmountInCents",
    refundedInCents: "refundedInCents",
    paidAt: "paidAt",
    squareReceiptUrl: "squareReceiptUrl",
  },
  orders: {
    id: "id",
    clientId: "clientId",
    orderNumber: "orderNumber",
    title: "title",
    description: "description",
    status: "status",
    quantity: "quantity",
    quotedInCents: "quotedInCents",
    finalInCents: "finalInCents",
    taxAmountInCents: "taxAmountInCents",
    fulfillmentMethod: "fulfillmentMethod",
    completedAt: "completedAt",
    createdAt: "createdAt",
  },
  invoices: {
    id: "id",
    clientId: "clientId",
    number: "number",
    description: "description",
    amountInCents: "amountInCents",
    taxAmountInCents: "taxAmountInCents",
    status: "status",
    issuedAt: "issuedAt",
    dueAt: "dueAt",
    paidAt: "paidAt",
  },
  threads: {
    id: "id",
    clientId: "clientId",
    subject: "subject",
    threadType: "threadType",
    status: "status",
    createdAt: "createdAt",
  },
  messages: {
    id: "id",
    threadId: "threadId",
    body: "body",
    channel: "channel",
    createdAt: "createdAt",
  },
  reviews: {
    id: "id",
    clientId: "clientId",
    rating: "rating",
    body: "body",
    serviceName: "serviceName",
    status: "status",
    createdAt: "createdAt",
  },
  formSubmissions: {
    id: "id",
    clientId: "clientId",
    data: "data",
    formVersion: "formVersion",
    submittedAt: "submittedAt",
  },
  serviceRecords: {
    id: "id",
    clientId: "clientId",
    lashMapping: "lashMapping",
    curlType: "curlType",
    diameter: "diameter",
    lengths: "lengths",
    adhesive: "adhesive",
    retentionNotes: "retentionNotes",
    productsUsed: "productsUsed",
    notes: "notes",
    reactions: "reactions",
    nextVisitNotes: "nextVisitNotes",
    createdAt: "createdAt",
  },
  loyaltyTransactions: {
    id: "id",
    profileId: "profileId",
    points: "points",
    type: "type",
    description: "description",
    createdAt: "createdAt",
  },
  notifications: {
    id: "id",
    profileId: "profileId",
    type: "type",
    channel: "channel",
    title: "title",
    body: "body",
    sentAt: "sentAt",
    readAt: "readAt",
  },
  membershipSubscriptions: { id: "id", clientId: "clientId" },
  bookingSubscriptions: { id: "id", clientId: "clientId" },
  waitlist: { id: "id", clientId: "clientId" },
  wishlistItems: { id: "id", clientId: "clientId" },
  services: { id: "id", name: "name", category: "category" },
}));

vi.mock("@/lib/audit", () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  inArray: vi.fn((_col: unknown, vals: unknown) => vals),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/client-export", () => {
  let GET: (request?: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: authenticated client user
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });

    // Default db behaviour:
    //   • First call  → profile lookup → returns MOCK_PROFILE
    //   • All subsequent calls (the 15 Promise.all selects) → empty arrays
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_PROFILE]))
      .mockReturnValue(makeSelectChain([]));

    mockLogAction.mockResolvedValue(undefined);

    vi.resetModules();

    // Re-register mocks after resetModules so the dynamic import picks them up
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
      }),
    }));

    vi.doMock("@/db", () => ({
      db: {
        select: (...args: unknown[]) => mockDbSelect(...args),
      },
    }));

    vi.doMock("@/db/schema", () => ({
      profiles: { id: "id", role: "role" },
      clientPreferences: { profileId: "profileId" },
      bookings: {
        id: "id",
        clientId: "clientId",
        serviceId: "serviceId",
        status: "status",
        startsAt: "startsAt",
        durationMinutes: "durationMinutes",
        totalInCents: "totalInCents",
        discountInCents: "discountInCents",
        clientNotes: "clientNotes",
        location: "location",
        confirmedAt: "confirmedAt",
        completedAt: "completedAt",
        cancelledAt: "cancelledAt",
        cancellationReason: "cancellationReason",
        createdAt: "createdAt",
      },
      payments: {
        id: "id",
        clientId: "clientId",
        status: "status",
        method: "method",
        amountInCents: "amountInCents",
        tipInCents: "tipInCents",
        taxAmountInCents: "taxAmountInCents",
        refundedInCents: "refundedInCents",
        paidAt: "paidAt",
        squareReceiptUrl: "squareReceiptUrl",
      },
      orders: {
        id: "id",
        clientId: "clientId",
        orderNumber: "orderNumber",
        title: "title",
        description: "description",
        status: "status",
        quantity: "quantity",
        quotedInCents: "quotedInCents",
        finalInCents: "finalInCents",
        taxAmountInCents: "taxAmountInCents",
        fulfillmentMethod: "fulfillmentMethod",
        completedAt: "completedAt",
        createdAt: "createdAt",
      },
      invoices: {
        id: "id",
        clientId: "clientId",
        number: "number",
        description: "description",
        amountInCents: "amountInCents",
        taxAmountInCents: "taxAmountInCents",
        status: "status",
        issuedAt: "issuedAt",
        dueAt: "dueAt",
        paidAt: "paidAt",
      },
      threads: {
        id: "id",
        clientId: "clientId",
        subject: "subject",
        threadType: "threadType",
        status: "status",
        createdAt: "createdAt",
      },
      messages: {
        id: "id",
        threadId: "threadId",
        body: "body",
        channel: "channel",
        createdAt: "createdAt",
      },
      reviews: {
        id: "id",
        clientId: "clientId",
        rating: "rating",
        body: "body",
        serviceName: "serviceName",
        status: "status",
        createdAt: "createdAt",
      },
      formSubmissions: {
        id: "id",
        clientId: "clientId",
        data: "data",
        formVersion: "formVersion",
        submittedAt: "submittedAt",
      },
      serviceRecords: {
        id: "id",
        clientId: "clientId",
        lashMapping: "lashMapping",
        curlType: "curlType",
        diameter: "diameter",
        lengths: "lengths",
        adhesive: "adhesive",
        retentionNotes: "retentionNotes",
        productsUsed: "productsUsed",
        notes: "notes",
        reactions: "reactions",
        nextVisitNotes: "nextVisitNotes",
        createdAt: "createdAt",
      },
      loyaltyTransactions: {
        id: "id",
        profileId: "profileId",
        points: "points",
        type: "type",
        description: "description",
        createdAt: "createdAt",
      },
      notifications: {
        id: "id",
        profileId: "profileId",
        type: "type",
        channel: "channel",
        title: "title",
        body: "body",
        sentAt: "sentAt",
        readAt: "readAt",
      },
      membershipSubscriptions: { id: "id", clientId: "clientId" },
      bookingSubscriptions: { id: "id", clientId: "clientId" },
      waitlist: { id: "id", clientId: "clientId" },
      wishlistItems: { id: "id", clientId: "clientId" },
      services: { id: "id", name: "name", category: "category" },
    }));

    vi.doMock("@/lib/audit", () => ({
      logAction: (...args: unknown[]) => mockLogAction(...args),
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: (...args: unknown[]) => mockCaptureException(...args),
    }));

    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((_col: unknown, val: unknown) => val),
      inArray: vi.fn((_col: unknown, vals: unknown) => vals),
    }));

    const mod = await import("./route");
    GET = mod.GET as unknown as typeof GET;
  });

  /* ---------- Auth ---------- */

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  /* ---------- Authorisation ---------- */

  it("returns 403 when profile is not found", async () => {
    // Reset so the first select returns empty (no profile row)
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  it("returns 403 when user is not a client role", async () => {
    // Reset so the first select returns an admin profile instead
    mockDbSelect.mockReset();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ ...MOCK_PROFILE, role: "admin" }]))
      .mockReturnValue(makeSelectChain([]));

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  /* ---------- Happy path ---------- */

  it("returns 200 with JSON data for authenticated client", async () => {
    const res = await GET();

    expect(res.status).toBe(200);

    const body = await res.json();

    // Top-level shape
    expect(body).toHaveProperty("exportedAt");
    expect(body).toHaveProperty("description");

    // Profile section is populated from the mock profile
    expect(body).toHaveProperty("profile");
    expect(body.profile).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@test.com",
    });

    // Data collection sections exist (empty arrays in the default mock)
    expect(body).toHaveProperty("preferences");
    expect(body).toHaveProperty("bookings");
    expect(Array.isArray(body.bookings)).toBe(true);
    expect(body).toHaveProperty("payments");
    expect(Array.isArray(body.payments)).toBe(true);
    expect(body).toHaveProperty("conversations");
    expect(Array.isArray(body.conversations)).toBe(true);
    expect(body).toHaveProperty("invoices");
    expect(body).toHaveProperty("orders");
    expect(body).toHaveProperty("reviews");
    expect(body).toHaveProperty("formSubmissions");
    expect(body).toHaveProperty("serviceRecords");
    expect(body).toHaveProperty("loyaltyTransactions");
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("memberships");
    expect(body).toHaveProperty("subscriptions");
    expect(body).toHaveProperty("waitlistEntries");
    expect(body).toHaveProperty("wishlistItems");
  });

  /* ---------- Content-Disposition ---------- */

  it("includes Content-Disposition header for download", async () => {
    const res = await GET();

    expect(res.status).toBe(200);

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toBeTruthy();
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toMatch(/filename="t-creative-my-data-\d{4}-\d{2}-\d{2}\.json"/);

    // Also verify no-store cache control
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  /* ---------- Audit log ---------- */

  it("calls logAction for audit trail", async () => {
    await GET();

    expect(mockLogAction).toHaveBeenCalledOnce();
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-123",
        action: "export",
        entityType: "client_data",
        entityId: "user-123",
      }),
    );
  });
});
