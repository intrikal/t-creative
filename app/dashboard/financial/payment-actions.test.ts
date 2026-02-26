import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Track DB operations
const mockSelectWhere = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: mockSelectWhere,
    })),
  })),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: mockUpdateWhere,
    })),
  })),
};

vi.mock("@/db", () => ({ db: mockDb }));

vi.mock("@/db/schema", () => ({
  payments: { id: "id", squarePaymentId: "squarePaymentId" },
  bookings: { id: "id", clientId: "clientId", serviceId: "serviceId", status: "status" },
  services: { id: "id", name: "name", category: "category" },
  profiles: { id: "id", firstName: "firstName", lastName: "lastName" },
  syncLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sql: vi.fn(),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
}));

vi.mock("drizzle-orm/pg-core", () => ({
  alias: vi.fn((_table: unknown, name: string) => ({ aliasName: name })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase auth
const mockGetUser = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock Square client
const mockSquarePaymentsGet = vi.fn();
const mockSquareRefundsRefund = vi.fn();
const mockCreateSquarePaymentLink = vi.fn();
vi.mock("@/lib/square", () => ({
  squareClient: {
    payments: { get: (...args: unknown[]) => mockSquarePaymentsGet(...args) },
    refunds: { refundPayment: (...args: unknown[]) => mockSquareRefundsRefund(...args) },
  },
  isSquareConfigured: vi.fn(() => true),
  createSquarePaymentLink: (...args: unknown[]) => mockCreateSquarePaymentLink(...args),
}));

vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("payment-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  describe("recordPayment", () => {
    it("throws when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const { recordPayment } = await import("./payment-actions");

      await expect(
        recordPayment({
          bookingId: 1,
          clientId: "client-1",
          amountInCents: 5000,
          method: "cash",
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when booking is not found", async () => {
      mockSelectWhere.mockResolvedValue([]); // No booking found

      // Need fresh import since "use server" modules may cache
      vi.resetModules();
      // Re-setup all mocks for fresh import
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { recordPayment } = await import("./payment-actions");

      await expect(
        recordPayment({
          bookingId: 999,
          clientId: "client-1",
          amountInCents: 5000,
          method: "cash",
        }),
      ).rejects.toThrow("Booking not found");
    });

    it("throws when client does not match booking", async () => {
      mockSelectWhere.mockResolvedValue([{ id: 1, clientId: "client-other" }]);

      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { recordPayment } = await import("./payment-actions");

      await expect(
        recordPayment({
          bookingId: 1,
          clientId: "client-wrong",
          amountInCents: 5000,
          method: "cash",
        }),
      ).rejects.toThrow("Client does not match booking");
    });

    it("inserts payment record for cash payment", async () => {
      mockSelectWhere.mockResolvedValue([{ id: 1, clientId: "client-1" }]);
      mockInsertValues.mockResolvedValue(undefined);

      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => false),
      }));

      const { recordPayment } = await import("./payment-actions");

      await recordPayment({
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        method: "cash",
        notes: "Cash collected in studio",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 1,
          clientId: "client-1",
          amountInCents: 5000,
          method: "cash",
          status: "paid",
          notes: "Cash collected in studio",
        }),
      );
    });

    it("enriches from Square API when squarePaymentId provided", async () => {
      mockSelectWhere.mockResolvedValue([{ id: 1, clientId: "client-1" }]);
      mockInsertValues.mockResolvedValue(undefined);
      mockSquarePaymentsGet.mockResolvedValue({
        payment: {
          receiptUrl: "https://squareup.com/receipt/abc",
          orderId: "order_xyz",
        },
      });

      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: {
          payments: { get: mockSquarePaymentsGet },
          refunds: { refundPayment: vi.fn() },
        },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { recordPayment } = await import("./payment-actions");

      await recordPayment({
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        method: "square_card",
        squarePaymentId: "sq_pay_123",
      });

      expect(mockSquarePaymentsGet).toHaveBeenCalledWith({ paymentId: "sq_pay_123" });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          squarePaymentId: "sq_pay_123",
          squareReceiptUrl: "https://squareup.com/receipt/abc",
          squareOrderId: "order_xyz",
        }),
      );
    });
  });

  describe("processRefund", () => {
    it("returns error when payment not found", async () => {
      mockSelectWhere.mockResolvedValue([]); // No payment

      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { processRefund } = await import("./payment-actions");

      const result = await processRefund({
        paymentId: 999,
        amountInCents: 1000,
      });

      expect(result).toEqual({ success: false, error: "Payment not found" });
    });

    it("returns error when refund amount is zero or negative", async () => {
      mockSelectWhere.mockResolvedValue([
        {
          id: 1,
          amountInCents: 5000,
          refundedInCents: 0,
          squarePaymentId: null,
          notes: null,
        },
      ]);

      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { processRefund } = await import("./payment-actions");

      const result = await processRefund({
        paymentId: 1,
        amountInCents: 0,
      });

      expect(result).toEqual({
        success: false,
        error: "Refund amount must be positive",
      });
    });

    it("returns error when refund exceeds refundable amount", async () => {
      mockSelectWhere.mockResolvedValue([
        {
          id: 1,
          amountInCents: 5000,
          refundedInCents: 3000, // Already refunded $30
          squarePaymentId: null,
          notes: null,
        },
      ]);

      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { processRefund } = await import("./payment-actions");

      const result = await processRefund({
        paymentId: 1,
        amountInCents: 3000, // Trying to refund $30 but only $20 available
      });

      expect(result).toEqual({
        success: false,
        error: "Maximum refundable amount is $20.00",
      });
    });

    it("processes cash refund without calling Square API", async () => {
      mockSelectWhere.mockResolvedValue([
        {
          id: 1,
          amountInCents: 5000,
          refundedInCents: 0,
          squarePaymentId: null, // Cash payment — no Square ID
          notes: null,
        },
      ]);

      vi.resetModules();

      const localMockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      const localMockUpdate = vi.fn(() => ({ set: localMockUpdateSet }));

      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: () =>
                Promise.resolve([
                  {
                    id: 1,
                    amountInCents: 5000,
                    refundedInCents: 0,
                    squarePaymentId: null,
                    notes: null,
                  },
                ]),
            })),
          })),
          insert: vi.fn(() => ({ values: vi.fn() })),
          update: localMockUpdate,
        },
      }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));

      const localMockRefund = vi.fn();
      vi.doMock("@/lib/square", () => ({
        squareClient: {
          payments: { get: vi.fn() },
          refunds: { refundPayment: localMockRefund },
        },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { processRefund } = await import("./payment-actions");

      const result = await processRefund({
        paymentId: 1,
        amountInCents: 5000,
        reason: "Customer requested",
      });

      expect(result).toEqual({ success: true });
      // Should NOT call Square API for cash payment
      expect(localMockRefund).not.toHaveBeenCalled();
      // Should update payment record
      expect(localMockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          refundedInCents: 5000,
          status: "refunded",
        }),
      );
    });

    it("calls Square Refunds API for card payments", async () => {
      vi.resetModules();

      const localMockRefund = vi.fn().mockResolvedValue({});
      const localMockInsertValues = vi.fn();
      const localMockUpdateSet = vi.fn(() => ({ where: vi.fn() }));

      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: () =>
                Promise.resolve([
                  {
                    id: 1,
                    amountInCents: 10000,
                    refundedInCents: 0,
                    squarePaymentId: "sq_pay_abc",
                    notes: null,
                  },
                ]),
            })),
          })),
          insert: vi.fn(() => ({ values: localMockInsertValues })),
          update: vi.fn(() => ({ set: localMockUpdateSet })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: {
          payments: { get: vi.fn() },
          refunds: { refundPayment: localMockRefund },
        },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { processRefund } = await import("./payment-actions");

      const result = await processRefund({
        paymentId: 1,
        amountInCents: 5000,
        reason: "Partial refund",
      });

      expect(result).toEqual({ success: true });
      expect(localMockRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "sq_pay_abc",
          amountMoney: {
            amount: BigInt(5000),
            currency: "USD",
          },
          reason: "Partial refund",
        }),
      );
      // Partial refund — $50 of $100
      expect(localMockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          refundedInCents: 5000,
          status: "partially_refunded",
        }),
      );
    });

    it("returns error when Square refund API fails", async () => {
      vi.resetModules();

      const localMockRefund = vi.fn().mockRejectedValue(new Error("Card declined"));
      const localMockInsertValues = vi.fn();

      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: () =>
                Promise.resolve([
                  {
                    id: 1,
                    amountInCents: 5000,
                    refundedInCents: 0,
                    squarePaymentId: "sq_pay_abc",
                    notes: null,
                  },
                ]),
            })),
          })),
          insert: vi.fn(() => ({ values: localMockInsertValues })),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {},
        services: {},
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: {
          payments: { get: vi.fn() },
          refunds: { refundPayment: localMockRefund },
        },
        isSquareConfigured: vi.fn(() => true),
      }));

      const { processRefund } = await import("./payment-actions");

      const result = await processRefund({
        paymentId: 1,
        amountInCents: 5000,
      });

      expect(result).toEqual({ success: false, error: "Card declined" });
      // Should log the failure to sync_log
      expect(localMockInsertValues).toHaveBeenCalled();
    });
  });

  describe("createPaymentLink", () => {
    it("returns error when Square is not configured", async () => {
      vi.resetModules();
      vi.doMock("@/db", () => ({ db: mockDb }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: { id: "id", serviceId: "serviceId", squareOrderId: "squareOrderId" },
        services: { id: "id", name: "name" },
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => false),
        createSquarePaymentLink: vi.fn(),
      }));

      const { createPaymentLink } = await import("./payment-actions");

      const result = await createPaymentLink({
        bookingId: 1,
        amountInCents: 5000,
        type: "deposit",
      });

      expect(result).toEqual({ success: false, error: "Square is not configured" });
    });

    it("returns error when booking is not found", async () => {
      vi.resetModules();

      const localMockSelectWhere = vi.fn().mockResolvedValue([]);
      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: localMockSelectWhere,
            })),
          })),
          insert: vi.fn(() => ({ values: vi.fn() })),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: { id: "id", serviceId: "serviceId", squareOrderId: "squareOrderId" },
        services: { id: "id", name: "name" },
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
        createSquarePaymentLink: vi.fn(),
      }));

      const { createPaymentLink } = await import("./payment-actions");

      const result = await createPaymentLink({
        bookingId: 999,
        amountInCents: 5000,
        type: "balance",
      });

      expect(result).toEqual({ success: false, error: "Booking not found" });
    });

    it("creates payment link and returns URL on success", async () => {
      vi.resetModules();

      let selectCallCount = 0;
      const localMockSelectWhere = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: booking lookup
          return Promise.resolve([{ id: 1, serviceId: 10 }]);
        }
        if (selectCallCount === 2) {
          // Second call: service name lookup
          return Promise.resolve([{ name: "Lash Extensions" }]);
        }
        // Third call: check existing squareOrderId
        return Promise.resolve([{ squareOrderId: null }]);
      });
      const localMockInsertValues = vi.fn();
      const localMockUpdateWhere = vi.fn();

      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: localMockSelectWhere,
              innerJoin: vi.fn(() => ({
                where: vi
                  .fn()
                  .mockResolvedValue([
                    { email: "test@test.com", firstName: "Test", notifyEmail: true },
                  ]),
              })),
            })),
          })),
          insert: vi.fn(() => ({ values: localMockInsertValues })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: localMockUpdateWhere })),
          })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: {
          id: "id",
          clientId: "clientId",
          serviceId: "serviceId",
          squareOrderId: "squareOrderId",
        },
        services: { id: "id", name: "name" },
        profiles: { id: "id", email: "email", firstName: "firstName", notifyEmail: "notifyEmail" },
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/resend", () => ({
        sendEmail: vi.fn().mockResolvedValue(true),
      }));

      const localMockCreateLink = vi.fn().mockResolvedValue({
        url: "https://square.link/u/abc123",
        orderId: "order_xyz",
      });
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
        createSquarePaymentLink: localMockCreateLink,
      }));

      const { createPaymentLink } = await import("./payment-actions");

      const result = await createPaymentLink({
        bookingId: 1,
        amountInCents: 5000,
        type: "deposit",
      });

      expect(result).toEqual({ success: true, url: "https://square.link/u/abc123" });
      expect(localMockCreateLink).toHaveBeenCalledWith({
        bookingId: 1,
        serviceName: "Lash Extensions",
        amountInCents: 5000,
        type: "deposit",
      });
      // Should store orderId on booking since it had none
      expect(localMockUpdateWhere).toHaveBeenCalled();
      // Should log to sync_log
      expect(localMockInsertValues).toHaveBeenCalled();
    });

    it("returns error when Square API fails", async () => {
      vi.resetModules();

      let selectCallCount = 0;
      const localMockSelectWhere = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return Promise.resolve([{ id: 1, serviceId: 10 }]);
        return Promise.resolve([{ name: "Consulting" }]);
      });
      const localMockInsertValues = vi.fn();

      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: localMockSelectWhere,
            })),
          })),
          insert: vi.fn(() => ({ values: localMockInsertValues })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn() })),
          })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        payments: {},
        bookings: { id: "id", serviceId: "serviceId", squareOrderId: "squareOrderId" },
        services: { id: "id", name: "name" },
        profiles: {},
        syncLog: {},
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        and: vi.fn(),
        sql: vi.fn(),
        inArray: vi.fn(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn(() => ({})),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: () => ({ data: { user: { id: "u1" } } }) },
        })),
      }));
      vi.doMock("@/lib/resend", () => ({
        sendEmail: vi.fn().mockResolvedValue(true),
      }));

      const localMockCreateLink = vi.fn().mockRejectedValue(new Error("Square API unavailable"));
      vi.doMock("@/lib/square", () => ({
        squareClient: { payments: { get: vi.fn() }, refunds: { refundPayment: vi.fn() } },
        isSquareConfigured: vi.fn(() => true),
        createSquarePaymentLink: localMockCreateLink,
      }));

      const { createPaymentLink } = await import("./payment-actions");

      const result = await createPaymentLink({
        bookingId: 1,
        amountInCents: 5000,
        type: "balance",
      });

      expect(result).toEqual({ success: false, error: "Square API unavailable" });
      // Should log failure to sync_log
      expect(localMockInsertValues).toHaveBeenCalled();
    });
  });
});
