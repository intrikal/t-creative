import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    groupBy: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockGetEmailRecipient = vi.fn().mockResolvedValue(null);
const mockRevalidatePath = vi.fn();

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
      const resolved = db ?? defaultDb;
      await cb(resolved);
    }),
  };
  if (db && !db.transaction) {
    db.transaction = vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
      await cb(db);
    });
  }

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    payments: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      amountInCents: "amountInCents",
      tipInCents: "tipInCents",
      refundedInCents: "refundedInCents",
      method: "method",
      status: "status",
      paidAt: "paidAt",
      createdAt: "createdAt",
      squarePaymentId: "squarePaymentId",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      startsAt: "startsAt",
      totalInCents: "totalInCents",
      depositPaidInCents: "depositPaidInCents",
      giftCardId: "giftCardId",
      discountInCents: "discountInCents",
      promotionId: "promotionId",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
      depositInCents: "depositInCents",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
    invoices: {
      id: "id",
      number: "number",
      clientId: "clientId",
      description: "description",
      amountInCents: "amountInCents",
      status: "status",
      issuedAt: "issuedAt",
      dueAt: "dueAt",
      paidAt: "paidAt",
      createdAt: "createdAt",
      isRecurring: "isRecurring",
      recurrenceInterval: "recurrenceInterval",
      nextDueAt: "nextDueAt",
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
    giftCards: {
      id: "id",
      code: "code",
      purchasedByClientId: "purchasedByClientId",
      recipientName: "recipientName",
      originalAmountInCents: "originalAmountInCents",
      balanceInCents: "balanceInCents",
      status: "status",
      purchasedAt: "purchasedAt",
      expiresAt: "expiresAt",
      notes: "notes",
    },
    giftCardTransactions: {
      id: "id",
      giftCardId: "giftCardId",
      type: "type",
      amountInCents: "amountInCents",
      balanceAfterInCents: "balanceAfterInCents",
      bookingId: "bookingId",
      performedBy: "performedBy",
      notes: "notes",
      createdAt: "createdAt",
    },
    promotions: {
      id: "id",
      code: "code",
      discountType: "discountType",
      discountValue: "discountValue",
      description: "description",
      appliesTo: "appliesTo",
      maxUses: "maxUses",
      redemptionCount: "redemptionCount",
      isActive: "isActive",
      startsAt: "startsAt",
      endsAt: "endsAt",
      createdAt: "createdAt",
    },
    orders: {
      id: "id",
      status: "status",
      finalInCents: "finalInCents",
    },
    settings: {
      key: "key",
      value: "value",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
      email: `${name}_email`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  for (const name of ["GiftCardDelivery", "GiftCardPurchase"]) {
    vi.doMock(`@/emails/${name}`, () => ({ [name]: vi.fn(() => null) }));
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("financial/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getPayments ---- */

  describe("getPayments", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getPayments } = await import("./actions");
      await expect(getPayments()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no payments exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getPayments } = await import("./actions");
      const result = await getPayments();
      expect(result).toEqual([]);
    });

    it("maps payment rows to PaymentRow shape", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        paidAt: new Date("2026-03-01T12:00:00Z"),
        createdAt: new Date("2026-03-01T10:00:00Z"),
        clientFirstName: "Jane",
        clientLastName: "Doe",
        serviceName: "Lash Extensions",
        serviceCategory: "lash",
        amountInCents: 10000,
        tipInCents: 1500,
        refundedInCents: 0,
        method: "cash",
        status: "paid",
        squarePaymentId: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getPayments } = await import("./actions");
      const result = await getPayments();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        client: "Jane Doe",
        service: "Lash Extensions",
        amount: 100,
        tip: 15,
        method: "cash",
        status: "paid",
      });
    });
  });

  /* ---- getRevenueStats ---- */

  describe("getRevenueStats", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getRevenueStats } = await import("./actions");
      await expect(getRevenueStats()).rejects.toThrow("Not authenticated");
    });

    it("returns RevenueStats shape with zero defaults", async () => {
      vi.resetModules();
      const statsRow = { totalRevenue: 0, totalTips: 0, count: 0 };
      const monthRow = { total: 0 };
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([statsRow]);
          return makeChain([monthRow]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getRevenueStats } = await import("./actions");
      const result = await getRevenueStats();
      expect(result).toMatchObject({
        totalRevenue: expect.any(Number),
        totalTips: expect.any(Number),
        transactionCount: expect.any(Number),
        avgTicket: expect.any(Number),
      });
    });
  });

  /* ---- getCategoryRevenue ---- */

  describe("getCategoryRevenue", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getCategoryRevenue } = await import("./actions");
      await expect(getCategoryRevenue()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no data", async () => {
      vi.resetModules();
      setupMocks();
      const { getCategoryRevenue } = await import("./actions");
      const result = await getCategoryRevenue();
      expect(result).toEqual([]);
    });
  });

  /* ---- getWeeklyRevenue ---- */

  describe("getWeeklyRevenue", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getWeeklyRevenue } = await import("./actions");
      await expect(getWeeklyRevenue()).rejects.toThrow("Not authenticated");
    });

    it("returns 7-day array even when DB is empty", async () => {
      vi.resetModules();
      setupMocks();
      const { getWeeklyRevenue } = await import("./actions");
      const result = await getWeeklyRevenue();
      expect(result).toHaveLength(7);
      expect(result[0]).toMatchObject({ day: expect.any(String), amount: 0 });
    });
  });

  /* ---- getInvoices ---- */

  describe("getInvoices", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getInvoices } = await import("./actions");
      await expect(getInvoices()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no invoices", async () => {
      vi.resetModules();
      setupMocks();
      const { getInvoices } = await import("./actions");
      const result = await getInvoices();
      expect(result).toEqual([]);
    });

    it("maps invoice rows to InvoiceRow shape", async () => {
      vi.resetModules();
      const now = new Date("2026-03-01T00:00:00Z");
      const row = {
        id: 5,
        number: "INV-001",
        clientFirstName: "Alice",
        clientLastName: "Smith",
        description: "Monthly retainer",
        amountInCents: 50000,
        status: "sent",
        issuedAt: now,
        dueAt: now,
        paidAt: null,
        createdAt: now,
        isRecurring: false,
        recurrenceInterval: null,
        nextDueAt: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInvoices } = await import("./actions");
      const result = await getInvoices();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 5,
        number: "INV-001",
        client: "Alice Smith",
        amount: 500,
        status: "sent",
      });
    });
  });

  /* ---- createInvoice ---- */

  describe("createInvoice", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createInvoice } = await import("./actions");
      await expect(
        createInvoice({ clientId: "c1", description: "Test", amountInCents: 5000 }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts invoice with auto-generated number starting at INV-001", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) }));
      setupMocks({
        select: vi.fn(() => makeChain([])), // no last invoice → starts at 001
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("./actions");
      await createInvoice({ clientId: "c1", description: "Test", amountInCents: 5000 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ number: "INV-001", amountInCents: 5000 }),
      );
    });

    it("increments invoice number from last existing invoice", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 2 }]) }));
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ number: "INV-005" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("./actions");
      await createInvoice({ clientId: "c1", description: "Next", amountInCents: 2000 });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ number: "INV-006" }));
    });

    it("sets nextDueAt for weekly recurring invoices", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("./actions");
      await createInvoice({
        clientId: "c1",
        description: "Weekly",
        amountInCents: 1000,
        dueAt: "2026-04-01",
        isRecurring: true,
        recurrenceInterval: "weekly",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecurring: true,
          nextDueAt: expect.any(Date),
        }),
      );
    });

    it("calls logAction after invoice creation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("./actions");
      await createInvoice({ clientId: "c1", description: "Audit test", amountInCents: 3000 });
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "invoice" }),
      );
    });

    it("revalidates /dashboard/financial", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createInvoice } = await import("./actions");
      await createInvoice({ clientId: "c1", description: "Revalidate", amountInCents: 1000 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- getExpenses ---- */

  describe("getExpenses", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getExpenses } = await import("./actions");
      await expect(getExpenses()).rejects.toThrow("Not authenticated");
    });

    it("maps expense rows to ExpenseRow shape", async () => {
      vi.resetModules();
      const row = {
        id: 3,
        expenseDate: new Date("2026-02-15"),
        category: "supplies",
        description: "Lash glue",
        vendor: "Beauty Supply Co",
        amountInCents: 3500,
        hasReceipt: true,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getExpenses } = await import("./actions");
      const result = await getExpenses();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 3,
        category: "supplies",
        description: "Lash glue",
        amount: 35,
        hasReceipt: true,
      });
    });
  });

  /* ---- createExpense ---- */

  describe("createExpense", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createExpense } = await import("./actions");
      await expect(
        createExpense({
          expenseDate: "2026-03-01",
          category: "supplies",
          description: "Test",
          amountInCents: 1000,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts expense with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createExpense } = await import("./actions");
      await createExpense({
        expenseDate: "2026-03-01",
        category: "supplies",
        description: "Lash glue",
        vendor: "Beauty Co",
        amountInCents: 2000,
        hasReceipt: true,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "supplies",
          description: "Lash glue",
          amountInCents: 2000,
          hasReceipt: true,
        }),
      );
    });

    it("calls logAction after expense creation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createExpense } = await import("./actions");
      await createExpense({
        expenseDate: "2026-03-01",
        category: "rent",
        description: "Studio",
        amountInCents: 50000,
      });
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "expense" }),
      );
    });

    it("revalidates /dashboard/financial", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createExpense } = await import("./actions");
      await createExpense({
        expenseDate: "2026-03-01",
        category: "other",
        description: "Misc",
        amountInCents: 500,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- getGiftCards ---- */

  describe("getGiftCards", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getGiftCards } = await import("./actions");
      await expect(getGiftCards()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no gift cards", async () => {
      vi.resetModules();
      setupMocks();
      const { getGiftCards } = await import("./actions");
      const result = await getGiftCards();
      expect(result).toEqual([]);
    });
  });

  /* ---- createGiftCard ---- */

  describe("createGiftCard", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createGiftCard } = await import("./actions");
      await expect(createGiftCard({ amountInCents: 5000 })).rejects.toThrow("Not authenticated");
    });

    it("creates gift card with auto-generated code TC-GC-001 when none exist", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      let insertCallCount = 0;
      setupMocks({
        select: vi.fn(() => makeChain([])), // no last card
        insert: vi.fn(() => ({
          values: vi.fn(() => {
            insertCallCount++;
            return { returning: vi.fn().mockResolvedValue([{ id: 10 }]) };
          }),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createGiftCard } = await import("./actions");
      await createGiftCard({ amountInCents: 5000 });
      // Two inserts: gift card + transaction
      expect(insertCallCount).toBe(2);
    });

    it("increments gift card code from last existing code", async () => {
      vi.resetModules();
      const insertedCodes: string[] = [];
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ code: "TC-GC-007" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn((vals: any) => {
            if (vals?.code) insertedCodes.push(vals.code);
            return { returning: vi.fn().mockResolvedValue([{ id: 8 }]) };
          }),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createGiftCard } = await import("./actions");
      await createGiftCard({ amountInCents: 10000 });
      expect(insertedCodes).toContain("TC-GC-008");
    });

    it("sends purchase email when buyer ID provided and email found", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({ email: "buyer@example.com", firstName: "Bob" });
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createGiftCard } = await import("./actions");
      await createGiftCard({ amountInCents: 5000, purchasedByClientId: "buyer-1" });
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "buyer@example.com", entityType: "gift_card_purchase" }),
      );
    });

    it("sends delivery email when recipient name provided", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({ email: "buyer@example.com", firstName: "Bob" });
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createGiftCard } = await import("./actions");
      await createGiftCard({
        amountInCents: 5000,
        purchasedByClientId: "buyer-1",
        recipientName: "Carol",
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(2); // purchase + delivery
    });

    it("calls logAction after creation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createGiftCard } = await import("./actions");
      await createGiftCard({ amountInCents: 2500 });
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "gift_card" }),
      );
    });

    it("revalidates /dashboard/financial", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createGiftCard } = await import("./actions");
      await createGiftCard({ amountInCents: 1000 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- getPromotions ---- */

  describe("getPromotions", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getPromotions } = await import("./actions");
      await expect(getPromotions()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no promotions", async () => {
      vi.resetModules();
      setupMocks();
      const { getPromotions } = await import("./actions");
      const result = await getPromotions();
      expect(result).toEqual([]);
    });
  });

  /* ---- createPromotion ---- */

  describe("createPromotion", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createPromotion } = await import("./actions");
      await expect(
        createPromotion({ code: "SAVE10", discountType: "percent", discountValue: 10 }),
      ).rejects.toThrow("Not authenticated");
    });

    it("uppercases promo code before inserting", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createPromotion } = await import("./actions");
      await createPromotion({ code: "summer20", discountType: "percent", discountValue: 20 });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ code: "SUMMER20" }));
    });

    it("revalidates /dashboard/financial", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createPromotion } = await import("./actions");
      await createPromotion({ code: "TEST", discountType: "fixed", discountValue: 500 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- redeemGiftCard ---- */

  describe("redeemGiftCard", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { redeemGiftCard } = await import("./actions");
      await expect(
        redeemGiftCard({ bookingId: 1, giftCardId: 1, amountInCents: 1000 }),
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when gift card not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemGiftCard } = await import("./actions");
      await expect(
        redeemGiftCard({ bookingId: 1, giftCardId: 99, amountInCents: 1000 }),
      ).rejects.toThrow("Gift card not found");
    });

    it("throws when gift card is not active", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1, status: "redeemed", balanceInCents: 5000 }])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemGiftCard } = await import("./actions");
      await expect(
        redeemGiftCard({ bookingId: 1, giftCardId: 1, amountInCents: 1000 }),
      ).rejects.toThrow("Gift card is not active");
    });

    it("throws when insufficient balance", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1, status: "active", balanceInCents: 500 }])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemGiftCard } = await import("./actions");
      await expect(
        redeemGiftCard({ bookingId: 1, giftCardId: 1, amountInCents: 1000 }),
      ).rejects.toThrow("Insufficient gift card balance");
    });

    it("updates gift card status to 'redeemed' when fully depleted", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1, status: "active", balanceInCents: 5000 }])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemGiftCard } = await import("./actions");
      await redeemGiftCard({ bookingId: 10, giftCardId: 1, amountInCents: 5000 });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ balanceInCents: 0, status: "redeemed" }),
      );
    });

    it("keeps gift card 'active' when partial balance remains", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1, status: "active", balanceInCents: 10000 }])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemGiftCard } = await import("./actions");
      await redeemGiftCard({ bookingId: 10, giftCardId: 1, amountInCents: 5000 });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ balanceInCents: 5000, status: "active" }),
      );
    });
  });

  /* ---- validatePromoCode ---- */

  describe("validatePromoCode", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { validatePromoCode } = await import("./actions");
      await expect(validatePromoCode("SAVE10")).rejects.toThrow("Not authenticated");
    });

    it("returns invalid when promo not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { validatePromoCode } = await import("./actions");
      const result = await validatePromoCode("NOTFOUND");
      expect(result).toMatchObject({ valid: false, message: "Promo code not found" });
    });

    it("returns invalid when promo is inactive", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              code: "SAVE10",
              isActive: false,
              endsAt: null,
              startsAt: null,
              maxUses: null,
              redemptionCount: 0,
              appliesTo: null,
              discountType: "percent",
              discountValue: 10,
            },
          ]),
        ),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { validatePromoCode } = await import("./actions");
      const result = await validatePromoCode("SAVE10");
      expect(result).toMatchObject({ valid: false, message: "Promo code is no longer active" });
    });

    it("returns valid for an active promo code", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              code: "SAVE10",
              isActive: true,
              endsAt: null,
              startsAt: null,
              maxUses: null,
              redemptionCount: 0,
              appliesTo: null,
              discountType: "percent",
              discountValue: 10,
            },
          ]),
        ),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { validatePromoCode } = await import("./actions");
      const result = await validatePromoCode("SAVE10");
      expect(result).toMatchObject({ valid: true, discountType: "percent", discountValue: 10 });
    });

    it("returns invalid when max uses reached", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              code: "LIMITED",
              isActive: true,
              endsAt: null,
              startsAt: null,
              maxUses: 5,
              redemptionCount: 5,
              appliesTo: null,
              discountType: "percent",
              discountValue: 10,
            },
          ]),
        ),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { validatePromoCode } = await import("./actions");
      const result = await validatePromoCode("LIMITED");
      expect(result).toMatchObject({ valid: false, message: "Promo code has reached max uses" });
    });
  });

  /* ---- applyPromoCode ---- */

  describe("applyPromoCode", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { applyPromoCode } = await import("./actions");
      await expect(applyPromoCode(1, "CODE")).rejects.toThrow("Not authenticated");
    });

    it("throws when promo not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { applyPromoCode } = await import("./actions");
      await expect(applyPromoCode(1, "NOTFOUND")).rejects.toThrow("Promo code not found");
    });

    it("throws when promo has reached max uses at apply time", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              code: "MAXED",
              discountType: "percent",
              discountValue: 10,
              maxUses: 5,
              redemptionCount: 5,
            },
          ]),
        ),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { applyPromoCode } = await import("./actions");
      await expect(applyPromoCode(1, "MAXED")).rejects.toThrow("Promo code has reached max uses");
    });

    it("throws when booking not found", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1)
            return makeChain([
              {
                id: 1,
                code: "SAVE10",
                discountType: "percent",
                discountValue: 10,
                redemptionCount: 0,
              },
            ]);
          return makeChain([]);
        }),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { applyPromoCode } = await import("./actions");
      await expect(applyPromoCode(999, "SAVE10")).rejects.toThrow("Booking not found");
    });

    it("applies percent discount to booking", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1)
            return makeChain([
              {
                id: 1,
                code: "SAVE10",
                discountType: "percent",
                discountValue: 10,
                redemptionCount: 0,
              },
            ]);
          return makeChain([{ id: 5, totalInCents: 10000 }]);
        }),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { applyPromoCode } = await import("./actions");
      await applyPromoCode(5, "SAVE10");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ discountInCents: 1000 }),
      );
    });

    it("revalidates /dashboard/financial", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1)
            return makeChain([
              { id: 1, code: "T", discountType: "fixed", discountValue: 500, redemptionCount: 0 },
            ]);
          return makeChain([{ id: 5, totalInCents: 10000 }]);
        }),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { applyPromoCode } = await import("./actions");
      await applyPromoCode(5, "T");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- getProductSales ---- */

  describe("getProductSales", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getProductSales } = await import("./actions");
      await expect(getProductSales()).rejects.toThrow("Not authenticated");
    });

    it("returns ProductSalesStats shape", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ total: 20000, count: 5 }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getProductSales } = await import("./actions");
      const result = await getProductSales();
      expect(result).toMatchObject({
        productRevenue: 200,
        productOrderCount: 5,
        avgOrderValue: 40,
      });
    });
  });
});
