/**
 * Tests for GET /api/receipts/[bookingId] — PDF receipt download.
 *
 * Covers:
 *  - Auth: unauthenticated → 401
 *  - Valid booking ID → returns PDF receipt with correct headers
 *  - Non-existent booking → 404
 *  - Booking belongs to different client (non-admin) → 403
 *
 * Mocks: Supabase auth (getUser), db.select (profile, booking, payments,
 * add-ons, services, staff), generateReceiptPdf,
 * getPublicBusinessProfile, Sentry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockCaptureException = vi.fn();
const mockDbSelect = vi.fn();
const mockGenerateReceiptPdf = vi.fn();
const mockGetBusinessProfile = vi.fn();

/** Thenable chain for db.select() — all methods return the chain */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    as: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.leftJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.limit as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.as as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

const MOCK_BOOKING = {
  id: 42,
  clientId: "user-1",
  status: "completed",
  startsAt: new Date("2026-04-10T14:00:00"),
  durationMinutes: 90,
  totalInCents: 15000,
  discountInCents: 0,
  depositPaidInCents: 5000,
  location: "Studio A",
  serviceName: "Classic Lash Set",
  clientFirstName: "Jane",
  clientLastName: "Doe",
  staffId: "staff-1",
};

const MOCK_PAYMENT = {
  amountInCents: 10000,
  tipInCents: 2000,
  taxAmountInCents: 750,
  method: "card",
  squarePaymentId: "sq_pay_123",
  paidAt: new Date("2026-04-10T15:30:00"),
  status: "paid",
};

const MOCK_BUSINESS_PROFILE = {
  businessName: "T Creative Studio",
  location: "123 Main St",
  phone: "+15551234567",
  email: "info@tcreative.studio",
};

/* ------------------------------------------------------------------ */
/*  Schema and drizzle mocks                                            */
/* ------------------------------------------------------------------ */

const schemaMock = {
  bookings: {
    id: "id",
    clientId: "clientId",
    serviceId: "serviceId",
    status: "status",
    startsAt: "startsAt",
    durationMinutes: "durationMinutes",
    totalInCents: "totalInCents",
    discountInCents: "discountInCents",
    depositPaidInCents: "depositPaidInCents",
    location: "location",
    staffId: "staffId",
  },
  bookingAddOns: { bookingId: "bookingId", addOnName: "addOnName", priceInCents: "priceInCents" },
  bookingServices: {
    bookingId: "bookingId",
    serviceId: "serviceId",
    priceInCents: "priceInCents",
    durationMinutes: "durationMinutes",
    orderIndex: "orderIndex",
  },
  payments: {
    bookingId: "bookingId",
    status: "status",
    amountInCents: "amountInCents",
    tipInCents: "tipInCents",
    taxAmountInCents: "taxAmountInCents",
    method: "method",
    squarePaymentId: "squarePaymentId",
    paidAt: "paidAt",
  },
  profiles: {
    id: "id",
    role: "role",
    firstName: "firstName",
    lastName: "lastName",
  },
  services: { id: "id", name: "name" },
};

/* ------------------------------------------------------------------ */
/*  Static mocks                                                        */
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

vi.mock("@/db/schema", () => schemaMock);

vi.mock("@/lib/generate-receipt-pdf", () => ({
  generateReceiptPdf: (...args: unknown[]) => mockGenerateReceiptPdf(...args),
}));

vi.mock("@/app/dashboard/settings/settings-actions", () => ({
  getPublicBusinessProfile: (...args: unknown[]) => mockGetBusinessProfile(...args),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeParams(bookingId: string): { params: Promise<{ bookingId: string }> } {
  return { params: Promise.resolve({ bookingId }) };
}

/**
 * Set up the default select mock sequence for a happy-path receipt request.
 *
 * Select call order in the route:
 *  1. Profile check → role
 *  2. Staff alias subquery (db.select().from().as()) → unused but consumes a call
 *  3. Booking fetch → booking row
 *  4. Payments (Promise.all) → payment rows
 *  5. AddOns (Promise.all) → add-on rows
 *  6. BookingServices (Promise.all) → service rows
 *  7. Staff lookup → staff name
 */
function setupHappyPath(overrides: { role?: string; booking?: unknown; payments?: unknown[] } = {}) {
  const role = overrides.role ?? "client";
  const booking = overrides.booking ?? MOCK_BOOKING;
  const payments = overrides.payments ?? [MOCK_PAYMENT];

  mockDbSelect
    .mockReturnValueOnce(makeSelectChain([{ role }]))       // 1. profile
    .mockReturnValueOnce(makeSelectChain([]))                // 2. staff alias (unused)
    .mockReturnValueOnce(makeSelectChain([booking]))         // 3. booking
    .mockReturnValueOnce(makeSelectChain(payments))          // 4. payments
    .mockReturnValueOnce(makeSelectChain([]))                // 5. add-ons
    .mockReturnValueOnce(makeSelectChain([]))                // 6. booking services
    .mockReturnValueOnce(makeSelectChain([{ firstName: "Jane", lastName: "Smith" }])); // 7. staff
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/receipts/[bookingId]", () => {
  let GET: (req: Request, ctx: { params: Promise<{ bookingId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: authenticated client who owns the booking
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGenerateReceiptPdf.mockResolvedValue(Buffer.from("fake-pdf"));
    mockGetBusinessProfile.mockResolvedValue(MOCK_BUSINESS_PROFILE);

    setupHappyPath();

    vi.resetModules();

    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
      }),
    }));
    vi.doMock("@/db", () => ({
      db: { select: (...args: unknown[]) => mockDbSelect(...args) },
    }));
    vi.doMock("@/db/schema", () => schemaMock);
    vi.doMock("@/lib/generate-receipt-pdf", () => ({
      generateReceiptPdf: (...args: unknown[]) => mockGenerateReceiptPdf(...args),
    }));
    vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
      getPublicBusinessProfile: (...args: unknown[]) => mockGetBusinessProfile(...args),
    }));
    vi.doMock("@sentry/nextjs", () => ({
      captureException: (...args: unknown[]) => mockCaptureException(...args),
    }));
    vi.doMock("drizzle-orm", () => ({
      and: vi.fn((...args: unknown[]) => args),
      eq: vi.fn((_col: unknown, val: unknown) => val),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  /* ---------- Auth ---------- */

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET(
      new Request("https://example.com/api/receipts/42"),
      makeParams("42"),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  /* ---------- Happy path ---------- */

  it("returns PDF receipt for a valid booking ID", async () => {
    const res = await GET(
      new Request("https://example.com/api/receipts/42"),
      makeParams("42"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("receipt-TC-42.pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("passes correct receipt data to PDF generator", async () => {
    await GET(
      new Request("https://example.com/api/receipts/42"),
      makeParams("42"),
    );

    expect(mockGenerateReceiptPdf).toHaveBeenCalledOnce();
    const receiptData = mockGenerateReceiptPdf.mock.calls[0][0];
    expect(receiptData).toMatchObject({
      businessName: "T Creative Studio",
      clientName: "Jane Doe",
      serviceName: "Classic Lash Set",
      bookingId: 42,
      serviceAmountInCents: 15000,
    });
  });

  /* ---------- Not found ---------- */

  it("returns 404 for a non-existent booking", async () => {
    mockDbSelect.mockReset();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ role: "client" }])) // profile
      .mockReturnValueOnce(makeSelectChain([]))                   // staff alias
      .mockReturnValueOnce(makeSelectChain([]));                  // booking not found

    const res = await GET(
      new Request("https://example.com/api/receipts/999"),
      makeParams("999"),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "Booking not found" });
  });

  /* ---------- Forbidden ---------- */

  it("returns 403 when booking belongs to different client (non-admin)", async () => {
    // User is "user-1" but booking belongs to "other-client"
    mockDbSelect.mockReset();
    setupHappyPath({ booking: { ...MOCK_BOOKING, clientId: "other-client" } });

    const res = await GET(
      new Request("https://example.com/api/receipts/42"),
      makeParams("42"),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  it("allows admin to access any client's receipt", async () => {
    mockDbSelect.mockReset();
    setupHappyPath({
      role: "admin",
      booking: { ...MOCK_BOOKING, clientId: "other-client" },
    });

    const res = await GET(
      new Request("https://example.com/api/receipts/42"),
      makeParams("42"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  /* ---------- Invalid booking ID ---------- */

  it("returns 400 for an invalid booking ID", async () => {
    mockDbSelect.mockReset();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ role: "client" }]));
    // staff alias consumes one call
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const res = await GET(
      new Request("https://example.com/api/receipts/abc"),
      makeParams("abc"),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid booking ID" });
  });
});
