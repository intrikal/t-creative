/**
 * @file actions.test.ts
 * @description Unit tests for marketplace/actions (products CRUD, stock
 * adjustment, supplies, commission quoting, order status with email notifications).
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

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures Resend sendEmail calls. */
const mockSendEmail = vi.fn().mockResolvedValue(true);
/** Captures getEmailRecipient calls to control which email address is returned. */
const mockGetEmailRecipient = vi.fn();
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    products: {
      id: "id",
      title: "title",
      category: "category",
      description: "description",
      pricingType: "pricingType",
      priceInCents: "priceInCents",
      priceMinInCents: "priceMinInCents",
      priceMaxInCents: "priceMaxInCents",
      stockCount: "stockCount",
      availability: "availability",
      isPublished: "isPublished",
      tags: "tags",
      serviceId: "serviceId",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      slug: "slug",
      productType: "productType",
    },
    orders: {
      id: "id",
      productId: "productId",
      clientId: "clientId",
      status: "status",
      orderNumber: "orderNumber",
      title: "title",
      quotedInCents: "quotedInCents",
      estimatedCompletionAt: "estimatedCompletionAt",
      internalNotes: "internalNotes",
      updatedAt: "updatedAt",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
    },
    supplies: {
      id: "id",
      name: "name",
      category: "category",
      unit: "unit",
      stockCount: "stockCount",
      reorderPoint: "reorderPoint",
      lastRestockedAt: "lastRestockedAt",
      updatedAt: "updatedAt",
    },
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      lastName: "lastName",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/emails/CommissionQuote", () => ({
    CommissionQuote: vi.fn(() => null),
  }));
  vi.doMock("@/emails/OrderStatusUpdate", () => ({
    OrderStatusUpdate: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("marketplace/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetEmailRecipient.mockResolvedValue(null);
  });

  /* ---- getProducts ---- */

  describe("getProducts", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getProducts } = await import("./actions");
      await expect(getProducts()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no products exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getProducts } = await import("./actions");
      const result = await getProducts();
      expect(result).toEqual([]);
    });

    it("maps product rows to ProductRow shape", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 1,
                title: "Mink Lashes",
                category: "lash-supplies",
                description: "Premium lashes",
                pricingType: "fixed_price",
                priceInCents: 2500,
                priceMinInCents: null,
                priceMaxInCents: null,
                stockCount: 10,
                availability: "in_stock",
                isPublished: true,
                tags: "lash,mink",
                serviceId: null,
              },
            ]);
          }
          // sales rows
          return makeChain([{ productId: 1, count: 5 }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue(undefined),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getProducts } = await import("./actions");
      const result = await getProducts();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Mink Lashes",
        category: "lash-supplies",
        pricingType: "fixed",
        price: 25,
        status: "active",
        sales: 5,
        tags: ["lash", "mink"],
      });
    });

    it("sets status to 'inactive' when isPublished is false", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 2,
                title: "Hidden Item",
                category: "merch",
                description: null,
                pricingType: "fixed_price",
                priceInCents: 1000,
                priceMinInCents: null,
                priceMaxInCents: null,
                stockCount: 5,
                availability: "in_stock",
                isPublished: false,
                tags: null,
                serviceId: null,
              },
            ]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue(undefined),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getProducts } = await import("./actions");
      const result = await getProducts();
      expect(result[0].status).toBe("inactive");
    });

    it("handles range pricing type correctly", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 3,
                title: "Custom Crochet",
                category: "crochet",
                description: null,
                pricingType: "price_range",
                priceInCents: null,
                priceMinInCents: 5000,
                priceMaxInCents: 15000,
                stockCount: 0,
                availability: "made_to_order",
                isPublished: true,
                tags: null,
                serviceId: null,
              },
            ]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue(undefined),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getProducts } = await import("./actions");
      const result = await getProducts();
      expect(result[0].pricingType).toBe("range");
      expect(result[0].price).toBe(50); // 5000/100
      expect(result[0].priceMax).toBe(150); // 15000/100
    });
  });

  /* ---- createProduct ---- */

  describe("createProduct", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createProduct } = await import("./actions");
      await expect(
        createProduct({
          name: "Test",
          category: "merch",
          description: "",
          pricingType: "fixed",
          price: 10,
          status: "active",
          tags: "",
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("calls db.insert with correct values for fixed pricing", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProduct } = await import("./actions");
      await createProduct({
        name: "Gold Bracelet",
        category: "jewelry",
        description: "Beautiful bracelet",
        pricingType: "fixed",
        price: 45,
        status: "active",
        tags: "gold,bracelet",
        stock: 3,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Gold Bracelet",
          category: "jewelry",
          pricingType: "fixed_price",
          priceInCents: 4500,
          isPublished: true,
          tags: "gold,bracelet",
        }),
      );
    });

    it("sets availability to out_of_stock when status is out_of_stock", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProduct } = await import("./actions");
      await createProduct({
        name: "Sold Out Item",
        category: "merch",
        description: "",
        pricingType: "fixed",
        price: 20,
        status: "out_of_stock",
        tags: "",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ availability: "out_of_stock", isPublished: true }),
      );
    });

    it("sets isPublished to false when status is inactive", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProduct } = await import("./actions");
      await createProduct({
        name: "Draft Item",
        category: "merch",
        description: "",
        pricingType: "fixed",
        price: 20,
        status: "inactive",
        tags: "",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: false }),
      );
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProduct } = await import("./actions");
      await createProduct({
        name: "Item",
        category: "merch",
        description: "",
        pricingType: "fixed",
        price: 10,
        status: "active",
        tags: "",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });

  /* ---- updateProduct ---- */

  describe("updateProduct", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateProduct } = await import("./actions");
      await expect(
        updateProduct(1, {
          name: "x",
          category: "merch",
          description: "",
          pricingType: "fixed",
          price: 10,
          status: "active",
          tags: "",
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with correct fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProduct } = await import("./actions");
      await updateProduct(5, {
        name: "Updated Bracelet",
        category: "jewelry",
        description: "Updated desc",
        pricingType: "fixed",
        price: 50,
        status: "active",
        tags: "gold",
        stock: 5,
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated Bracelet",
          category: "jewelry",
          priceInCents: 5000,
          isPublished: true,
        }),
      );
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProduct } = await import("./actions");
      await updateProduct(5, {
        name: "Item",
        category: "merch",
        description: "",
        pricingType: "fixed",
        price: 10,
        status: "active",
        tags: "",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });

  /* ---- deleteProduct ---- */

  describe("deleteProduct", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteProduct } = await import("./actions");
      await expect(deleteProduct(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the product", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteProduct } = await import("./actions");
      await deleteProduct(88);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteProduct } = await import("./actions");
      await deleteProduct(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });

  /* ---- adjustProductStock ---- */

  describe("adjustProductStock", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { adjustProductStock } = await import("./actions");
      await expect(adjustProductStock(1, 5)).rejects.toThrow("Not authenticated");
    });

    it("increases stock by delta", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ stockCount: 10 }])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { adjustProductStock } = await import("./actions");
      await adjustProductStock(1, 5);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ stockCount: 15, availability: "in_stock" }),
      );
    });

    it("clamps stock to 0 when delta is negative and exceeds current stock", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ stockCount: 3 }])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { adjustProductStock } = await import("./actions");
      await adjustProductStock(1, -10);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ stockCount: 0, availability: "out_of_stock" }),
      );
    });

    it("sets availability to out_of_stock when new stock is 0", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ stockCount: 5 }])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { adjustProductStock } = await import("./actions");
      await adjustProductStock(1, -5);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ stockCount: 0, availability: "out_of_stock" }),
      );
    });

    it("does not update when product is not found", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { adjustProductStock } = await import("./actions");
      await adjustProductStock(999, 5);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ stockCount: 5 }])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { adjustProductStock } = await import("./actions");
      await adjustProductStock(1, 2);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });

  /* ---- createSupply ---- */

  describe("createSupply", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createSupply } = await import("./actions");
      await expect(
        createSupply({
          name: "Glue",
          category: "adhesives",
          unit: "bottle",
          stock: 10,
          reorder: 2,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts supply with correct values", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSupply } = await import("./actions");
      await createSupply({
        name: "Glue",
        category: "adhesives",
        unit: "bottle",
        stock: 10,
        reorder: 2,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Glue",
          category: "adhesives",
          unit: "bottle",
          stockCount: 10,
          reorderPoint: 2,
        }),
      );
    });

    it("sets lastRestockedAt when initial stock > 0", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSupply } = await import("./actions");
      await createSupply({
        name: "Tweezers",
        category: "tools",
        unit: "pair",
        stock: 5,
        reorder: 1,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ lastRestockedAt: expect.any(Date) }),
      );
    });

    it("sets lastRestockedAt to null when initial stock is 0", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSupply } = await import("./actions");
      await createSupply({
        name: "New Tool",
        category: "tools",
        unit: "piece",
        stock: 0,
        reorder: 1,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ lastRestockedAt: null }),
      );
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSupply } = await import("./actions");
      await createSupply({
        name: "Glue",
        category: "adhesives",
        unit: "bottle",
        stock: 5,
        reorder: 2,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });

  /* ---- quoteCommission ---- */

  describe("quoteCommission", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { quoteCommission } = await import("./actions");
      await expect(quoteCommission(1, 5000)).rejects.toThrow("Not authenticated");
    });

    it("updates order with quoted amount and status 'quoted'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { quoteCommission } = await import("./actions");
      await quoteCommission(10, 25000);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ quotedInCents: 25000, status: "quoted" }),
      );
    });

    it("sends commission quote email when client profile has email", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // orders query after update
            return makeChain([
              {
                clientId: "client-1",
                orderNumber: "ORD-001",
                title: "Custom Crochet Blanket",
                estimatedCompletionAt: null,
              },
            ]);
          }
          // profile query
          return makeChain([{ email: "client@example.com", firstName: "Jane" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { quoteCommission } = await import("./actions");
      await quoteCommission(10, 25000);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          entityType: "commission_quote",
        }),
      );
    });

    it("does not throw when order is not found (non-fatal)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])), // no order found
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { quoteCommission } = await import("./actions");
      await expect(quoteCommission(999, 5000)).resolves.toBeUndefined();
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      // Need to return an order so the function doesn't early-return inside the try block
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                clientId: "c1",
                orderNumber: "ORD-001",
                title: "Custom Crochet",
                estimatedCompletionAt: null,
              },
            ]);
          }
          // profile with no email — skips sendEmail but continues to revalidatePath
          return makeChain([{ email: null, firstName: "Jane" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { quoteCommission } = await import("./actions");
      await quoteCommission(10, 5000);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });

  /* ---- updateOrderStatus ---- */

  describe("updateOrderStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateOrderStatus } = await import("./actions");
      await expect(updateOrderStatus(1, "completed")).rejects.toThrow("Not authenticated");
    });

    it("updates order status", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await updateOrderStatus(5, "in_progress");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "in_progress" }),
      );
    });

    it("sets completedAt when status is completed", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await updateOrderStatus(5, "completed");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", completedAt: expect.any(Date) }),
      );
    });

    it("sets cancelledAt when status is cancelled", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await updateOrderStatus(5, "cancelled");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(Date) }),
      );
    });

    it("sends status email for ready_for_pickup when recipient found", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({
        email: "client@example.com",
        firstName: "Jane",
      });
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          return makeChain([{ clientId: "c1", orderNumber: "ORD-001", title: "Bracelet" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await updateOrderStatus(5, "ready_for_pickup");
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          entityType: "order_status_update",
        }),
      );
    });

    it("does not send email for non-notify statuses (e.g. in_progress)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await updateOrderStatus(5, "in_progress");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does not throw when email send fails (non-fatal)", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({
        email: "client@example.com",
        firstName: "Jane",
      });
      mockSendEmail.mockRejectedValue(new Error("email failed"));
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ clientId: "c1", orderNumber: "ORD-001", title: "Bracelet" }]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await expect(updateOrderStatus(5, "completed")).resolves.toBeUndefined();
    });

    it("revalidates /dashboard/marketplace", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateOrderStatus } = await import("./actions");
      await updateOrderStatus(5, "accepted");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/marketplace");
    });
  });
});
