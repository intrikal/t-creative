/**
 * Tests for GET /api/cron/zoho-books — batch invoice sync to Zoho Books.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - Not configured: Zoho Books env vars missing → 200 with skip message
 *  - No-op: no unsynced entities → zero counts across all three categories
 *  - Bookings: confirmed booking without zohoInvoiceId → creates invoice
 *  - Orders: accepted order without zohoInvoiceId → creates invoice
 *  - Enrollments: enrolled enrollment without zohoInvoiceId → creates invoice
 *  - Error handling: createZohoBooksInvoice throws → increments failed counter,
 *    captured by Sentry
 *
 * Mocks: db (select chain), createZohoBooksInvoice,
 * isZohoBooksConfigured, Sentry.
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
const mockCreateInvoice = vi.fn();
const mockIsZohoBooksConfigured = vi.fn();

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

describe("GET /api/cron/zoho-books", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockCreateInvoice.mockResolvedValue(undefined);
    mockIsZohoBooksConfigured.mockReturnValue(true);
    process.env.CRON_SECRET = "test-secret";

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      bookings: {
        id: "id",
        clientId: "clientId",
        totalInCents: "totalInCents",
        depositPaidInCents: "depositPaidInCents",
        status: "status",
        serviceId: "serviceId",
        zohoInvoiceId: "zohoInvoiceId",
      },
      orders: {
        id: "id",
        clientId: "clientId",
        title: "title",
        finalInCents: "finalInCents",
        quantity: "quantity",
        status: "status",
        zohoInvoiceId: "zohoInvoiceId",
      },
      enrollments: {
        id: "id",
        clientId: "clientId",
        programId: "programId",
        status: "status",
        zohoInvoiceId: "zohoInvoiceId",
      },
      profiles: {
        id: "id",
        email: "email",
        firstName: "firstName",
        lastName: "lastName",
        phone: "phone",
      },
      services: { id: "id", name: "name" },
      trainingPrograms: { id: "id", name: "name", priceInCents: "priceInCents" },
    }));
    vi.doMock("@/lib/zoho-books", () => ({
      createZohoBooksInvoice: mockCreateInvoice,
      isZohoBooksConfigured: mockIsZohoBooksConfigured,
    }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/zoho-books", {
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

  /* ---------- Not configured ---------- */

  it("returns 200 with skip message when Zoho Books is not configured", async () => {
    mockIsZohoBooksConfigured.mockReturnValueOnce(false);

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message: expect.stringContaining("not configured") });
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });

  /* ---------- No-op ---------- */

  it("returns zero counts when nothing needs syncing", async () => {
    selectData[0] = []; // bookings
    selectData[1] = []; // orders
    selectData[2] = []; // enrollments

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      bookingsFound: 0,
      ordersFound: 0,
      enrollmentsFound: 0,
      synced: 0,
      failed: 0,
    });
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });

  /* ---------- Happy path: bookings ---------- */

  it("syncs unsynced confirmed bookings", async () => {
    selectData[0] = [
      {
        id: 10,
        clientId: "c1",
        totalInCents: 8000,
        depositPaidInCents: 2000,
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        clientLastName: "Smith",
        clientPhone: "+15550001111",
        serviceName: "Haircut",
      },
    ];
    selectData[1] = []; // orders
    selectData[2] = []; // enrollments

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toMatchObject({ bookingsFound: 1, synced: 1, failed: 0 });
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "booking",
        entityId: 10,
        email: "alice@example.com",
      }),
    );
  });

  /* ---------- Happy path: orders ---------- */

  it("syncs unsynced accepted orders", async () => {
    selectData[0] = []; // bookings
    selectData[1] = [
      {
        id: 20,
        clientId: "c2",
        title: "Print Package",
        finalInCents: 15000,
        quantity: 1,
        clientEmail: "bob@example.com",
        clientFirstName: "Bob",
      },
    ];
    selectData[2] = []; // enrollments

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toMatchObject({ ordersFound: 1, synced: 1, failed: 0 });
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "order", entityId: 20 }),
    );
  });

  /* ---------- Happy path: enrollments ---------- */

  it("syncs unsynced enrollments", async () => {
    selectData[0] = []; // bookings
    selectData[1] = []; // orders
    selectData[2] = [
      {
        id: 30,
        clientId: "c3",
        clientEmail: "carol@example.com",
        clientFirstName: "Carol",
        programName: "Beginner Photography",
        priceInCents: 20000,
      },
    ];

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toMatchObject({ enrollmentsFound: 1, synced: 1, failed: 0 });
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "enrollment", entityId: 30 }),
    );
  });

  /* ---------- Error handling ---------- */

  it("counts failures when createZohoBooksInvoice throws", async () => {
    selectData[0] = [
      {
        id: 1,
        clientId: "c1",
        totalInCents: 5000,
        depositPaidInCents: null,
        clientEmail: "x@y.com",
        clientFirstName: "X",
        clientLastName: null,
        clientPhone: null,
        serviceName: "Cut",
      },
    ];
    selectData[1] = [];
    selectData[2] = [];
    mockCreateInvoice.mockRejectedValueOnce(new Error("Zoho error"));

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toMatchObject({ bookingsFound: 1, synced: 0, failed: 1 });
  });
});
