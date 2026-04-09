// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns an object that is both awaitable (thenable) and chainable.
 * Every builder method returns the same object so any call chain can be
 * awaited and will resolve to `rows`.
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
    offset: () => chain,
    as: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

// vi.fn(): creates a mock function that records how it was called.
// mockRequireAdmin simulates the requireAdmin auth guard -- tests set its return value to control authentication state.
const mockRequireAdmin = vi.fn();
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  setupMocks                                                         */
/* ------------------------------------------------------------------ */

// Registers vi.doMock() calls for all external dependencies (DB, auth, schema, Sentry, etc.)
// so the imported server actions run against fakes instead of real services.
function setupMocks(db: Record<string, any> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  // Mock schema with all tables referenced by client detail actions
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      role: "role",
      phone: "phone",
      source: "source",
      isVip: "isVip",
      lifecycleStage: "lifecycleStage",
      internalNotes: "internalNotes",
      tags: "tags",
      createdAt: "createdAt",
      referredBy: "referredBy",
      onboardingData: "onboardingData",
      squareCustomerId: "squareCustomerId",
      notifyEmail: "notifyEmail",
    },
    clientPreferences: { profileId: "profileId" },
    bookings: {
      id: "id",
      clientId: "clientId",
      startsAt: "startsAt",
      status: "status",
      serviceId: "serviceId",
      staffId: "staffId",
      totalInCents: "totalInCents",
      durationMinutes: "durationMinutes",
      location: "location",
      clientNotes: "clientNotes",
      staffNotes: "staffNotes",
      discountInCents: "discountInCents",
      deletedAt: "deletedAt",
    },
    payments: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
      status: "status",
      method: "method",
      amountInCents: "amountInCents",
      tipInCents: "tipInCents",
      refundedInCents: "refundedInCents",
      paidAt: "paidAt",
      createdAt: "createdAt",
    },
    serviceRecords: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      staffId: "staffId",
      lashMapping: "lashMapping",
      curlType: "curlType",
      diameter: "diameter",
      lengths: "lengths",
      adhesive: "adhesive",
      retentionNotes: "retentionNotes",
      productsUsed: "productsUsed",
      notes: "notes",
      reactions: "reactions",
      nextVisitNotes: "nextVisitNotes",
      createdAt: "createdAt",
    },
    services: { id: "id", name: "name", category: "category" },
    loyaltyTransactions: {
      id: "id",
      profileId: "profileId",
      points: "points",
      type: "type",
      description: "description",
      createdAt: "createdAt",
    },
    threads: {
      id: "id",
      clientId: "clientId",
      subject: "subject",
      threadType: "threadType",
      status: "status",
      lastMessageAt: "lastMessageAt",
    },
    messages: { id: "id", threadId: "threadId" },
    clientNotes: {
      id: "id",
      profileId: "profileId",
      type: "type",
      content: "content",
      isPinned: "isPinned",
      authorId: "authorId",
      createdAt: "createdAt",
    },
    formSubmissions: {
      id: "id",
      clientId: "clientId",
      formId: "formId",
      formVersion: "formVersion",
      submittedAt: "submittedAt",
      data: "data",
    },
    clientForms: { id: "id", name: "name", type: "type" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
    sum: vi.fn((...args: unknown[]) => ({ type: "sum", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: mockRequireAdmin,
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("getClientDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "user-1", email: "admin@test.com" });
  });

  it("throws when user is not authenticated", async () => {
    vi.resetModules();
    mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
    setupMocks();
    const { getClientDetail } = await import("./actions");
    await expect(getClientDetail("c1")).rejects.toThrow();
  });

  it("returns null for non-existent client", async () => {
    vi.resetModules();
    setupMocks({
      select: vi.fn(() => makeChain([])), // profile query returns nothing
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("nonexistent");
    expect(result).toBeNull();
  });

  it("returns complete client data when client exists", async () => {
    vi.resetModules();
    let selectCount = 0;
    const profileRow = {
      id: "c1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "+1234",
      source: "instagram",
      isVip: true,
      lifecycleStage: "active",
      internalNotes: "VIP client",
      tags: "lash",
      createdAt: new Date("2024-01-01"),
      referredBy: null,
      onboardingData: null,
      role: "client",
    };
    setupMocks({
      select: vi.fn(() => {
        selectCount++;
        if (selectCount === 1) return makeChain([]); // referrer subquery (as)
        if (selectCount === 2) return makeChain([profileRow]); // profile
        if (selectCount === 3) return makeChain([]); // staffAlias subquery (as)
        return makeChain([]); // all subsequent queries return empty
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("c1");
    expect(result).not.toBeNull();
    expect(result!.profile.firstName).toBe("Jane");
    expect(result!.profile.email).toBe("jane@example.com");
  });
});
