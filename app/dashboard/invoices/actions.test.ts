/**
 * @file actions.test.ts
 * @description Unit tests for invoices/actions (client invoices, payment
 * mapping, type inference from description, combined sorting).
 *
 * Testing utilities: describe, it, expect, vi, vi.doMock, vi.resetModules,
 * vi.clearAllMocks, beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 */
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    invoices: {
      id: "id",
      number: "number",
      description: "description",
      amountInCents: "amountInCents",
      status: "status",
      issuedAt: "issuedAt",
      dueAt: "dueAt",
      paidAt: "paidAt",
      createdAt: "createdAt",
      clientId: "clientId",
    },
    payments: {
      id: "id",
      amountInCents: "amountInCents",
      tipInCents: "tipInCents",
      refundedInCents: "refundedInCents",
      status: "status",
      squareReceiptUrl: "squareReceiptUrl",
      paidAt: "paidAt",
      createdAt: "createdAt",
      clientId: "clientId",
      bookingId: "bookingId",
    },
    bookings: { id: "id", serviceId: "serviceId", staffId: "staffId", clientId: "clientId" },
    services: { id: "id", name: "name", category: "category" },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("invoices/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientInvoices ---- */

  describe("getClientInvoices", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientInvoices } = await import("./actions");
      await expect(getClientInvoices()).rejects.toThrow("Not authenticated");
    });

    it("returns empty invoiceRows when no invoices or payments", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows).toEqual([]);
    });

    it("maps invoice rows to ClientInvoiceRow shape", async () => {
      vi.resetModules();
      const invoiceRow = {
        id: "inv-1",
        number: "INV-001",
        description: "Lash fill appointment",
        amountInCents: 8000,
        status: "paid",
        issuedAt: new Date("2026-03-01T00:00:00Z"),
        dueAt: null,
        paidAt: new Date("2026-03-01T00:00:00Z"),
        createdAt: new Date("2026-03-01T00:00:00Z"),
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([invoiceRow]);
          return makeChain([]); // payments
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows).toHaveLength(1);
      expect(result.invoiceRows[0]).toMatchObject({
        id: "INV-001",
        status: "paid",
        amount: 80,
        type: "invoice",
      });
    });

    it("infers 'deposit' type from description keyword", async () => {
      vi.resetModules();
      const invoiceRow = {
        id: "inv-2",
        number: "INV-002",
        description: "Deposit for lash appointment",
        amountInCents: 3000,
        status: "paid",
        issuedAt: new Date("2026-03-01T00:00:00Z"),
        dueAt: null,
        paidAt: null,
        createdAt: new Date("2026-03-01T00:00:00Z"),
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([invoiceRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows[0].type).toBe("deposit");
    });

    it("infers 'training' type from description keyword", async () => {
      vi.resetModules();
      const invoiceRow = {
        id: "inv-3",
        number: "INV-003",
        description: "Lash training certification",
        amountInCents: 50000,
        status: "sent",
        issuedAt: new Date("2026-03-01T00:00:00Z"),
        dueAt: null,
        paidAt: null,
        createdAt: new Date("2026-03-01T00:00:00Z"),
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([invoiceRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows[0].type).toBe("training");
      expect(result.invoiceRows[0].status).toBe("pending");
    });

    it("maps payment rows to ClientInvoiceRow shape with PMT- prefix id", async () => {
      vi.resetModules();
      const paymentRow = {
        id: 42,
        amountInCents: 15000,
        tipInCents: 0,
        refundedInCents: 0,
        status: "paid",
        squareReceiptUrl: "https://sq.link/receipt",
        paidAt: new Date("2026-03-10T00:00:00Z"),
        createdAt: new Date("2026-03-10T00:00:00Z"),
        serviceName: "Lash Extensions",
        serviceCategory: "lash",
        staffFirstName: "Alex",
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]); // invoices
          return makeChain([paymentRow]); // payments
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows).toHaveLength(1);
      expect(result.invoiceRows[0]).toMatchObject({
        id: "PMT-0042",
        type: "appointment",
        status: "paid",
        amount: 150,
        receiptUrl: "https://sq.link/receipt",
      });
    });

    it("maps 'refunded' payment status correctly", async () => {
      vi.resetModules();
      const paymentRow = {
        id: 5,
        amountInCents: 5000,
        tipInCents: 0,
        refundedInCents: 5000,
        status: "refunded",
        squareReceiptUrl: null,
        paidAt: null,
        createdAt: new Date("2026-03-05T00:00:00Z"),
        serviceName: "Service",
        serviceCategory: "lash",
        staffFirstName: null,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]);
          return makeChain([paymentRow]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows[0].status).toBe("refunded");
    });

    it("combines invoices and payments sorted by date descending", async () => {
      vi.resetModules();
      const invoiceRow = {
        id: "inv-1",
        number: "INV-001",
        description: "Deposit",
        amountInCents: 3000,
        status: "paid",
        issuedAt: new Date("2026-01-01T00:00:00Z"),
        dueAt: null,
        paidAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      };
      const paymentRow = {
        id: 1,
        amountInCents: 10000,
        tipInCents: 0,
        refundedInCents: 0,
        status: "paid",
        squareReceiptUrl: null,
        paidAt: new Date("2026-03-01T00:00:00Z"),
        createdAt: new Date("2026-03-01T00:00:00Z"),
        serviceName: "Lash",
        serviceCategory: "lash",
        staffFirstName: null,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([invoiceRow]);
          return makeChain([paymentRow]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientInvoices } = await import("./actions");
      const result = await getClientInvoices();
      expect(result.invoiceRows).toHaveLength(2);
      // Payment (March) should come before invoice (January) when sorted desc
      expect(result.invoiceRows[0].id).toBe("PMT-0001");
    });
  });
});
