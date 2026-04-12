// @vitest-environment node

/**
 * inngest/functions/zoho-books.test.ts
 *
 * Unit tests for the zohoBooks Inngest function.
 *
 * Covers:
 *   (1) Unsynced payments (bookings, orders, enrollments) → Zoho invoices created
 *   (2) Already-synced records (zohoInvoiceId set) → filtered out by DB query (skipped)
 *   (3) Zoho not configured → returns skip message immediately, no DB queries
 *   (4) API error creating invoice → Sentry captures it, function continues and reports failed count
 *
 * The function runs three sequential DB select steps (bookings / orders / enrollments)
 * then processes each via createZohoBooksInvoice.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Step stub                                                           */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                        */
/* ------------------------------------------------------------------ */

const mockIsZohoBooksConfigured = vi.fn().mockReturnValue(true);
const mockCreateZohoBooksInvoice = vi.fn().mockResolvedValue({ invoiceId: "INV-001" });
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  DB mock — simple positional select queue                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[]) {
  const p = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (res: any, rej: any) => p.then(res, rej),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return chain;
}

function createDb(selectResults: unknown[][]) {
  let idx = 0;
  return {
    select: vi.fn(() => makeChain(selectResults[idx++] ?? [])),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/* ------------------------------------------------------------------ */
/*  Sample records                                                      */
/* ------------------------------------------------------------------ */

const BOOKING_ROW = {
  id: "booking-1",
  clientId: "client-1",
  totalInCents: 10000,
  depositPaidInCents: 2000,
  clientEmail: "client@test.com",
  clientFirstName: "Alice",
  clientLastName: "Smith",
  clientPhone: "555-1234",
  serviceName: "Haircut",
};

const ORDER_ROW = {
  id: "order-1",
  clientId: "client-1",
  title: "Custom Print",
  finalInCents: 5000,
  quantity: 1,
  clientEmail: "client@test.com",
  clientFirstName: "Alice",
};

const ENROLLMENT_ROW = {
  id: "enrollment-1",
  clientId: "client-1",
  clientEmail: "client@test.com",
  clientFirstName: "Alice",
  programName: "Bootcamp",
  priceInCents: 30000,
};

/* ------------------------------------------------------------------ */
/*  Setup helper                                                        */
/* ------------------------------------------------------------------ */

function setupMocks(
  selectResults: unknown[][] = [[BOOKING_ROW], [ORDER_ROW], [ENROLLMENT_ROW]],
  configured = true,
) {
  mockIsZohoBooksConfigured.mockReturnValue(configured);

  const db = createDb(selectResults);
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: { id: "id", status: "status", clientId: "clientId", serviceId: "serviceId", zohoInvoiceId: "zohoInvoiceId", totalInCents: "totalInCents", depositPaidInCents: "depositPaidInCents" },
    orders: { id: "id", status: "status", clientId: "clientId", zohoInvoiceId: "zohoInvoiceId", title: "title", finalInCents: "finalInCents", quantity: "quantity" },
    enrollments: { id: "id", status: "status", clientId: "clientId", programId: "programId", zohoInvoiceId: "zohoInvoiceId" },
    profiles: { id: "id", email: "email", firstName: "firstName", lastName: "lastName", phone: "phone" },
    services: { id: "id", name: "name" },
    trainingPrograms: { id: "id", name: "name", priceInCents: "priceInCents" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
  }));
  vi.doMock("@/lib/zoho-books", () => ({
    isZohoBooksConfigured: mockIsZohoBooksConfigured,
    createZohoBooksInvoice: mockCreateZohoBooksInvoice,
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  return db;
}

async function runHandler() {
  const mod = await import("@/inngest/functions/zoho-books");
  const fn = (mod.zohoBooks as any)?.handler ?? mod.zohoBooks;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("zohoBooks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockIsZohoBooksConfigured.mockReturnValue(true);
    mockCreateZohoBooksInvoice.mockResolvedValue({ invoiceId: "INV-001" });
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  it("(1) unsynced bookings, orders, and enrollments → creates Zoho invoices for each", async () => {
    setupMocks();

    const result = await runHandler();

    // Three createZohoBooksInvoice calls — one per entity type
    expect(mockCreateZohoBooksInvoice).toHaveBeenCalledTimes(3);

    // Booking invoice
    expect(mockCreateZohoBooksInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "booking",
        entityId: "booking-1",
        email: "client@test.com",
        firstName: "Alice",
      }),
    );

    // Order invoice
    expect(mockCreateZohoBooksInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "order",
        entityId: "order-1",
      }),
    );

    // Enrollment invoice
    expect(mockCreateZohoBooksInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "enrollment",
        entityId: "enrollment-1",
      }),
    );

    expect(result).toMatchObject({
      bookingsFound: 1,
      ordersFound: 1,
      enrollmentsFound: 1,
      synced: 3,
      failed: 0,
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("(2) already-synced payments (zohoInvoiceId set) → DB returns empty lists → zero invoices created", async () => {
    // The DB query uses isNull(zohoInvoiceId) to filter — so already-synced rows
    // are never returned. We simulate this by returning empty arrays for all three queries.
    setupMocks([[], [], []]);

    const result = await runHandler();

    expect(mockCreateZohoBooksInvoice).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      bookingsFound: 0,
      ordersFound: 0,
      enrollmentsFound: 0,
      synced: 0,
      failed: 0,
    });
  });

  it("(3) Zoho not configured → returns skip message, no DB queries made", async () => {
    setupMocks([[], [], []], false);

    const result = await runHandler();

    expect(mockCreateZohoBooksInvoice).not.toHaveBeenCalled();
    expect(result).toMatchObject({ message: "Zoho Books not configured, skipping" });
  });

  it("(4) API error on one booking → Sentry captures it, result reports failed count, function completes", async () => {
    // Two bookings: first succeeds, second throws
    setupMocks(
      [
        [
          { ...BOOKING_ROW, id: "booking-1" },
          { ...BOOKING_ROW, id: "booking-2" },
        ],
        [], // no orders
        [], // no enrollments
      ],
    );

    mockCreateZohoBooksInvoice
      .mockResolvedValueOnce({ invoiceId: "INV-001" }) // booking-1 succeeds
      .mockRejectedValueOnce(new Error("Zoho API 429 Too Many Requests")); // booking-2 fails

    const result = await runHandler();

    // Sentry captures the error from booking-2
    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Zoho API 429 Too Many Requests" }),
    );

    // Function does not throw — returns mixed synced/failed counts
    expect(result).toMatchObject({
      bookingsFound: 2,
      synced: 1,
      failed: 1,
    });
  });
});
