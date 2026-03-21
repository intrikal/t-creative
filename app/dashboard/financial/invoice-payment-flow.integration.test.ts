// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the invoice creation and payment recording flow.
 *
 * Calls real functions from:
 *   - invoice-expense-actions.ts: createInvoice
 *   - payment-actions.ts:         recordPayment
 *
 * Verifies FINAL STATE in the stateful mock DB:
 *   - createInvoice generates sequential INV-XXX numbers
 *   - createInvoice sets nextDueAt for recurring invoices
 *   - recordPayment inserts a payment record with status "paid"
 *   - recordPayment throws when booking not found
 *   - recordPayment throws when clientId does not match booking
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const invoicesTable: MockRow[] = [];
  const paymentsTable: MockRow[] = [];
  const bookingsTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _invoices: invoicesTable,
    _payments: paymentsTable,
    _bookings: bookingsTable,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };

        // Route by shape: invoices have "number" or (description + amountInCents without bookingId)
        if (
          "number" in values ||
          ("description" in values &&
            "amountInCents" in values &&
            !("bookingId" in values))
        ) {
          invoicesTable.push(row);
        } else if ("bookingId" in values && "method" in values) {
          paymentsTable.push(row);
        }

        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((_values: MockRow) => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared mock instances (created once, reused across tests)          */
/* ------------------------------------------------------------------ */

const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockRevalidatePath = vi.fn();
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    invoices: {
      id: "id",
      clientId: "clientId",
      number: "number",
      description: "description",
      amountInCents: "amountInCents",
      taxAmountInCents: "taxAmountInCents",
      status: "status",
      dueAt: "dueAt",
      issuedAt: "issuedAt",
      paidAt: "paidAt",
      notes: "notes",
      isRecurring: "isRecurring",
      recurrenceInterval: "recurrenceInterval",
      nextDueAt: "nextDueAt",
      createdAt: "createdAt",
    },
    payments: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      amountInCents: "amountInCents",
      tipInCents: "tipInCents",
      taxAmountInCents: "taxAmountInCents",
      method: "method",
      status: "status",
      paidAt: "paidAt",
      squarePaymentId: "squarePaymentId",
      squareOrderId: "squareOrderId",
      squareReceiptUrl: "squareReceiptUrl",
      notes: "notes",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
    syncLog: {
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      errorMessage: "errorMessage",
    },
    expenses: { id: "id" },
    services: { id: "id", name: "name", category: "category" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    squareClient: {},
    createSquarePaymentLink: vi.fn(),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: vi.fn().mockResolvedValue(true),
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Invoice payment flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    mockLogAction.mockResolvedValue(undefined);
  });

  /* ---------------------------------------------------------------- */
  /*  createInvoice                                                    */
  /* ---------------------------------------------------------------- */

  it("createInvoice generates INV-001 when no invoices exist", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // SELECT last invoice → empty (no invoices yet)
    db._queue([]);

    setupMocks(db);
    const { createInvoice } = await import("./invoice-expense-actions");

    await createInvoice({
      clientId: "client-1",
      description: "Lash set",
      amountInCents: 8000,
    });

    expect(db._invoices).toHaveLength(1);
    expect(db._invoices[0].number).toBe("INV-001");
    expect(db._invoices[0].amountInCents).toBe(8000);
  });

  it("createInvoice increments from last invoice number", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // SELECT last invoice → INV-007
    db._queue([{ number: "INV-007" }]);

    setupMocks(db);
    const { createInvoice } = await import("./invoice-expense-actions");

    await createInvoice({
      clientId: "client-1",
      description: "Lash fill",
      amountInCents: 5000,
    });

    expect(db._invoices).toHaveLength(1);
    expect(db._invoices[0].number).toBe("INV-008");
  });

  it("createInvoice creates recurring invoice with nextDueAt set to one month later", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // SELECT last invoice → empty
    db._queue([]);

    setupMocks(db);
    const { createInvoice } = await import("./invoice-expense-actions");

    await createInvoice({
      clientId: "client-1",
      description: "Monthly membership",
      amountInCents: 12000,
      isRecurring: true,
      recurrenceInterval: "monthly",
      dueAt: "2026-04-01",
    });

    expect(db._invoices).toHaveLength(1);
    const invoice = db._invoices[0];

    // nextDueAt should be defined
    expect(invoice.nextDueAt).toBeDefined();

    // It should be in May 2026 (one month after April 2026)
    const nextDueAt = invoice.nextDueAt as Date;
    expect(nextDueAt.getFullYear()).toBe(2026);
    expect(nextDueAt.getMonth()).toBe(4); // May = month index 4
  });

  /* ---------------------------------------------------------------- */
  /*  recordPayment                                                    */
  /* ---------------------------------------------------------------- */

  it("recordPayment inserts payment with correct fields", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // SELECT booking → found
    db._queue([{ id: 10, clientId: "client-1" }]);

    setupMocks(db);
    const { recordPayment } = await import("./payment-actions");

    await recordPayment({
      bookingId: 10,
      clientId: "client-1",
      amountInCents: 5000,
      method: "cash",
    });

    expect(db._payments).toHaveLength(1);
    expect(db._payments[0].bookingId).toBe(10);
    expect(db._payments[0].method).toBe("cash");
    expect(db._payments[0].status).toBe("paid");
  });

  it("recordPayment throws when booking not found", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // SELECT booking → not found
    db._queue([]);

    setupMocks(db);
    const { recordPayment } = await import("./payment-actions");

    await expect(
      recordPayment({
        bookingId: 999,
        clientId: "client-1",
        amountInCents: 5000,
        method: "cash",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("recordPayment throws when clientId does not match booking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // SELECT booking → found but with a different clientId
    db._queue([{ id: 10, clientId: "different-client" }]);

    setupMocks(db);
    const { recordPayment } = await import("./payment-actions");

    await expect(
      recordPayment({
        bookingId: 10,
        clientId: "client-1",
        amountInCents: 5000,
        method: "cash",
      }),
    ).rejects.toThrow(/client/i);
  });
});
