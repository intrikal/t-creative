import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * @file review-rating-flow.integration.test.ts
 * Integration tests for the review rating flow.
 *
 * These tests verify the complete lifecycle of `approveReview`,
 * `featureReview`, `rejectReview`, and `saveReply` using a shared
 * stateful mock DB that tracks state across DB calls to verify the
 * correct sequence of mutations.
 */

/* ------------------------------------------------------------------ */
/*  Stateful DB mock                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

/**
 * Creates a mock DB that tracks review rows in memory.
 * Test assertions read _reviews to verify final state after mutations.
 */
function createStatefulDb() {
  const _reviews: MockRow[] = [];

  // Queue of rows to return for select calls, consumed in order
  const selectQueue: unknown[][] = [];

  function makeChain(rows: unknown[]) {
    const resolved = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: (_fields?: any) => resolved,
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    return chain;
  }

  return {
    // State accessors for assertions
    _reviews,

    // Queue the next set of rows that a select call should return
    _queueSelect: (rows: unknown[]) => {
      selectQueue.push(rows);
    },

    select: vi.fn((_fields?: any) => {
      const rows = selectQueue.shift() ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        return {
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // All mutations target the reviews table — always update last review
          const review = _reviews[_reviews.length - 1];
          if (review) Object.assign(review, values);
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

/** Registers all module mocks using the stateful DB instance. */
function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    reviews: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
      source: "source",
      rating: "rating",
      body: "body",
      serviceName: "serviceName",
      status: "status",
      isFeatured: "isFeatured",
      staffResponse: "staffResponse",
      staffRespondedAt: "staffRespondedAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      staffId: "staffId",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));

  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({ aliasName: name })),
    pgTable: vi.fn(),
    pgEnum: vi.fn(),
    text: vi.fn(),
    integer: vi.fn(),
    boolean: vi.fn(),
    timestamp: vi.fn(),
    uuid: vi.fn(),
  }));

  vi.doMock("@/lib/audit", () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: mockGetUser },
    }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Integration tests                                                  */
/* ------------------------------------------------------------------ */

describe("Review rating flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  /* ---- approveReview ---- */

  describe("approveReview", () => {
    it("sets review status to approved", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a pending review
      db._reviews.push({
        id: 1,
        clientId: "client-1",
        rating: 5,
        body: "Great service!",
        status: "pending",
        isFeatured: false,
        staffResponse: null,
        staffRespondedAt: null,
      });

      setupMocks(db);
      const { approveReview } = await import("./actions");

      await approveReview(1);

      expect(db._reviews[0].status).toBe("approved");
    });
  });

  /* ---- featureReview ---- */

  describe("featureReview", () => {
    it("sets isFeatured to true and status to approved", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a pending review
      db._reviews.push({
        id: 1,
        clientId: "client-1",
        rating: 5,
        body: "Amazing experience!",
        status: "pending",
        isFeatured: false,
        staffResponse: null,
        staffRespondedAt: null,
      });

      setupMocks(db);
      const { featureReview } = await import("./actions");

      await featureReview(1);

      expect(db._reviews[0].isFeatured).toBe(true);
      expect(db._reviews[0].status).toBe("approved");
    });
  });

  /* ---- rejectReview ---- */

  describe("rejectReview", () => {
    it("sets status to rejected and clears isFeatured", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a featured review
      db._reviews.push({
        id: 1,
        clientId: "client-1",
        rating: 4,
        body: "Good but could be better.",
        status: "approved",
        isFeatured: true,
        staffResponse: null,
        staffRespondedAt: null,
      });

      setupMocks(db);
      const { rejectReview } = await import("./actions");

      await rejectReview(1);

      expect(db._reviews[0].status).toBe("rejected");
      expect(db._reviews[0].isFeatured).toBe(false);
    });
  });

  /* ---- saveReply ---- */

  describe("saveReply", () => {
    it("stores the staff response", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed an approved review
      db._reviews.push({
        id: 1,
        clientId: "client-1",
        rating: 5,
        body: "Loved it!",
        status: "approved",
        isFeatured: false,
        staffResponse: null,
        staffRespondedAt: null,
      });

      setupMocks(db);
      const { saveReply } = await import("./actions");

      await saveReply(1, "Thank you!");

      expect(db._reviews[0].staffResponse).toBe("Thank you!");
      expect(db._reviews[0].staffRespondedAt).toBeDefined();
    });

    it("clears staffResponse when empty string passed", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a review that already has a response
      db._reviews.push({
        id: 1,
        clientId: "client-1",
        rating: 5,
        body: "Wonderful!",
        status: "approved",
        isFeatured: false,
        staffResponse: "Previous reply",
        staffRespondedAt: new Date(),
      });

      setupMocks(db);
      const { saveReply } = await import("./actions");

      await saveReply(1, "");

      expect(db._reviews[0].staffResponse).toBeNull();
    });
  });
});
