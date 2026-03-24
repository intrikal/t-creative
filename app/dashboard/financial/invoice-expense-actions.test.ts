import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/financial/invoice-expense-actions.ts
 *
 * Covers:
 *  createInvoice   — auto-increments invoice number, recurring nextDueAt
 *  createExpense   — all valid categories, hasReceipt flag, vendor optional
 *  markInvoicePaid — not exported; overdue/paid status is set by DB, not this module
 *  overdue         — getInvoices returns status from DB unchanged
 *  categories      — createExpense rejects invalid category (Zod)
 *  negative amount — createInvoice and createExpense reject non-positive amountInCents (Zod)
 *  date filter     — getInvoices/getExpenses pass through DB ordering (no client filtering)
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, drizzle-orm/pg-core, @/lib/auth,
 *        @/lib/audit, @sentry/nextjs, next/cache.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
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

const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockLogAction = vi.fn();
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const db = makeDefaultDb();
  if (dbOverrides) Object.assign(db, dbOverrides);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    invoices: {
      id: "id",
      number: "number",
      clientId: "clientId",
      description: "description",
      amountInCents: "amountInCents",
      taxAmountInCents: "taxAmountInCents",
      status: "status",
      issuedAt: "issuedAt",
      dueAt: "dueAt",
      paidAt: "paidAt",
      notes: "notes",
      isRecurring: "isRecurring",
      recurrenceInterval: "recurrenceInterval",
      nextDueAt: "nextDueAt",
      createdAt: "createdAt",
    },
    expenses: {
      id: "id",
      expenseDate: "expenseDate",
      category: "category",
      description: "description",
      vendor: "vendor",
      amountInCents: "amountInCents",
      hasReceipt: "hasReceipt",
      createdBy: "createdBy",
    },
    profiles: { id: "id", firstName: "firstName", lastName: "lastName" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
}

function makeDefaultDb() {
  return {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("invoice-expense-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- createInvoice ---- */

  describe("createInvoice", () => {
    it("generates sequential invoice number (INV-002 after INV-001)", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          // Last invoice lookup
          if (selectCall === 1) return makeChain([{ number: "INV-001" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await createInvoice({
        clientId: "client-1",
        description: "Lash service",
        amountInCents: 12000,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          number: "INV-002",
          clientId: "client-1",
          amountInCents: 12000,
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });

    it("starts at INV-001 when no prior invoices exist", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await createInvoice({
        clientId: "client-1",
        description: "First invoice",
        amountInCents: 5000,
      });

      expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ number: "INV-001" }));
    });

    it("calculates nextDueAt one month out for monthly recurring invoice", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await createInvoice({
        clientId: "client-1",
        description: "Monthly retainer",
        amountInCents: 20000,
        isRecurring: true,
        recurrenceInterval: "monthly",
        dueAt: "2026-04-01",
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecurring: true,
          recurrenceInterval: "monthly",
          nextDueAt: expect.any(Date),
        }),
      );
      // nextDueAt should be ~30 days after dueAt
      const call = mockValues.mock.calls[0][0];
      const nextDue: Date = call.nextDueAt;
      expect(nextDue.getMonth()).toBe(4); // May (month index 4)
    });

    it("throws (Zod) when amountInCents is negative", async () => {
      vi.resetModules();
      setupMocks();
      const { createInvoice } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await expect(
        createInvoice({
          clientId: "client-1",
          description: "Refund",
          amountInCents: -500,
        }),
      ).rejects.toThrow();
    });

    it("logs audit action after successful creation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await createInvoice({
        clientId: "client-1",
        description: "Lash set",
        amountInCents: 8000,
      });

      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "invoice",
          actorId: "admin-1",
        }),
      );
    });
  });

  /* ---- createExpense ---- */

  describe("createExpense", () => {
    it("inserts an expense with all valid categories", async () => {
      const categories = [
        "supplies",
        "rent",
        "marketing",
        "equipment",
        "software",
        "travel",
        "other",
      ] as const;

      for (const category of categories) {
        vi.resetModules();
        const mockValues = vi.fn().mockResolvedValue(undefined);
        setupMocks({
          select: vi.fn(() => makeChain([])),
          insert: vi.fn(() => ({ values: mockValues })),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          delete: vi.fn(() => ({ where: vi.fn() })),
        });
        const { createExpense } = await import("@/app/dashboard/financial/invoice-expense-actions");

        await createExpense({
          expenseDate: "2026-04-01",
          category,
          description: `Test ${category}`,
          amountInCents: 1000,
        });

        expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ category }));
      }
    });

    it("stores hasReceipt flag and optional vendor", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createExpense } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await createExpense({
        expenseDate: "2026-04-01",
        category: "supplies",
        description: "Lash adhesive",
        vendor: "Acme Supplies",
        amountInCents: 3500,
        hasReceipt: true,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          vendor: "Acme Supplies",
          hasReceipt: true,
          amountInCents: 3500,
        }),
      );
    });

    it("throws (Zod) when category is invalid", async () => {
      vi.resetModules();
      setupMocks();
      const { createExpense } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await expect(
        createExpense({
          expenseDate: "2026-04-01",
          category: "food" as any,
          description: "Lunch",
          amountInCents: 2000,
        }),
      ).rejects.toThrow();
    });

    it("throws (Zod) when amountInCents is zero or negative", async () => {
      vi.resetModules();
      setupMocks();
      const { createExpense } = await import("@/app/dashboard/financial/invoice-expense-actions");

      await expect(
        createExpense({
          expenseDate: "2026-04-01",
          category: "rent",
          description: "Studio rent",
          amountInCents: 0,
        }),
      ).rejects.toThrow();
    });
  });

  /* ---- getInvoices ---- */

  describe("getInvoices", () => {
    it("returns overdue status unchanged from DB", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              number: "INV-001",
              clientFirstName: "Jane",
              clientLastName: "Doe",
              description: "Service",
              amountInCents: 10000,
              status: "overdue",
              issuedAt: new Date("2026-02-01"),
              dueAt: new Date("2026-02-15"),
              paidAt: null,
              createdAt: new Date("2026-02-01"),
              isRecurring: false,
              recurrenceInterval: null,
              nextDueAt: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInvoices } = await import("@/app/dashboard/financial/invoice-expense-actions");

      const rows = await getInvoices();

      expect(rows[0].status).toBe("overdue");
      expect(rows[0].client).toBe("Jane Doe");
      expect(rows[0].amount).toBe(100); // cents → dollars
    });
  });

  /* ---- getExpenses ---- */

  describe("getExpenses", () => {
    it("returns formatted rows sorted by date descending (DB handles sort)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              expenseDate: new Date("2026-04-01"),
              category: "supplies",
              description: "Adhesive",
              vendor: null,
              amountInCents: 4500,
              hasReceipt: false,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getExpenses } = await import("@/app/dashboard/financial/invoice-expense-actions");

      const rows = await getExpenses();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        category: "supplies",
        description: "Adhesive",
        amount: 45,
        hasReceipt: false,
      });
    });
  });
});
