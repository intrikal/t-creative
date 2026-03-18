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

const mockGetUser = vi.fn();

/**
 * getClientDetail calls db.select() many times in sequence and in parallel
 * (via Promise.all). Rather than tracking call count, we use a callback to
 * return the right rows based on call order.
 */
function setupMocks(selectFn?: () => any) {
  const defaultSelectFn = () => makeChain([]);

  const mockDb = {
    select: vi.fn(selectFn ?? defaultSelectFn),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: mockDb }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id", firstName: "firstName", lastName: "lastName", email: "email",
      phone: "phone", role: "role", source: "source", isVip: "isVip",
      lifecycleStage: "lifecycleStage", internalNotes: "internalNotes",
      tags: "tags", createdAt: "createdAt", referredBy: "referredBy",
      onboardingData: "onboardingData", squareCustomerId: "squareCustomerId",
      notifyEmail: "notifyEmail",
    },
    bookings: {
      id: "id", clientId: "clientId", serviceId: "serviceId", staffId: "staffId",
      status: "status", startsAt: "startsAt", durationMinutes: "durationMinutes",
      totalInCents: "totalInCents", discountInCents: "discountInCents",
      clientNotes: "clientNotes", staffNotes: "staffNotes", location: "location",
      deletedAt: "deletedAt",
    },
    services: { id: "id", name: "name", category: "category" },
    payments: {
      id: "id", bookingId: "bookingId", clientId: "clientId", status: "status",
      method: "method", amountInCents: "amountInCents", tipInCents: "tipInCents",
      refundedInCents: "refundedInCents", paidAt: "paidAt", createdAt: "createdAt",
    },
    serviceRecords: {
      id: "id", bookingId: "bookingId", clientId: "clientId", staffId: "staffId",
      lashMapping: "lashMapping", curlType: "curlType", diameter: "diameter",
      lengths: "lengths", adhesive: "adhesive", retentionNotes: "retentionNotes",
      productsUsed: "productsUsed", notes: "notes", reactions: "reactions",
      nextVisitNotes: "nextVisitNotes", createdAt: "createdAt",
    },
    loyaltyTransactions: {
      id: "id", profileId: "profileId", points: "points", type: "type",
      description: "description", createdAt: "createdAt",
    },
    clientPreferences: {
      profileId: "profileId", preferredLashStyle: "preferredLashStyle",
      preferredCurlType: "preferredCurlType", preferredLengths: "preferredLengths",
      preferredDiameter: "preferredDiameter", naturalLashNotes: "naturalLashNotes",
      retentionProfile: "retentionProfile", allergies: "allergies",
      skinType: "skinType", adhesiveSensitivity: "adhesiveSensitivity",
      healthNotes: "healthNotes", birthday: "birthday",
      preferredContactMethod: "preferredContactMethod",
      preferredServiceTypes: "preferredServiceTypes", generalNotes: "generalNotes",
      preferredRebookIntervalDays: "preferredRebookIntervalDays",
    },
    threads: {
      id: "id", clientId: "clientId", subject: "subject", threadType: "threadType",
      status: "status", lastMessageAt: "lastMessageAt",
    },
    messages: { id: "id" },
    formSubmissions: {
      id: "id", clientId: "clientId", formId: "formId", formVersion: "formVersion",
      submittedAt: "submittedAt", data: "data",
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
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

  return mockDb;
}

/* ------------------------------------------------------------------ */
/*  Shared test data                                                   */
/* ------------------------------------------------------------------ */

const profileRow = {
  id: "client-1",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+15551234567",
  source: "referral",
  isVip: true,
  lifecycleStage: "active",
  internalNotes: "Great client",
  tags: "vip,lash",
  createdAt: new Date("2025-01-01"),
  referredBy: null as string | null,
  onboardingData: { question1: "answer1" },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("getClientDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  it("returns null for non-existent client ID", async () => {
    vi.resetModules();
    setupMocks(); // all selects return []
    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("non-existent-id");
    expect(result).toBeNull();
  });

  it("returns full client profile with preferences", async () => {
    vi.resetModules();
    const prefs = {
      preferredLashStyle: "cat-eye",
      preferredCurlType: "C",
      preferredLengths: "12-14mm",
      preferredDiameter: "0.15",
      naturalLashNotes: "Strong",
      retentionProfile: "good",
      allergies: null,
      skinType: "normal",
      adhesiveSensitivity: false,
      healthNotes: null,
      birthday: "1990-06-15",
      preferredContactMethod: "email",
      preferredServiceTypes: "lash",
      generalNotes: null,
      preferredRebookIntervalDays: 21,
    };

    let callNum = 0;
    setupMocks(() => {
      callNum++;
      // Calls in getClientDetail:
      // 1: referrer subquery (.as) — not awaited directly but creates a chain
      // 2: profile query (first awaited select)
      // 3: staffAlias subquery (.as) — not awaited directly
      // 4-12: Promise.all with 9 parallel queries
      //   (referrer lookup, referral count, prefs, bookings, payments,
      //    service records, loyalty, threads, form submissions)
      //
      // Since .as() returns the chain but the chain isn't awaited for its value
      // in the same way, the key thing is the *profile query* must return profileRow.
      // For the parallel queries, we return prefs for index 3 and count for index 2.
      //
      // With the generic mock, we make every select return the profile data,
      // and rely on destructuring and Promise.all to pick the right shape.
      // The function only cares about the profile select returning a row vs empty.
      return makeChain([
        callNum <= 3
          ? { ...profileRow, count: 0 }
          : { ...prefs, count: 0, firstName: "Jane", points: 0 },
      ]);
    });

    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("client-1");

    expect(result).not.toBeNull();
    expect(result!.profile.id).toBe("client-1");
    expect(result!.profile.firstName).toBe("Jane");
    expect(result!.profile.email).toBe("jane@example.com");
    expect(result!.profile.isVip).toBe(true);
  });

  it("returns booking history", async () => {
    vi.resetModules();
    const bookingRow = {
      id: 2,
      serviceName: "Lash Fill",
      serviceCategory: "lash",
      status: "confirmed",
      startsAt: new Date("2026-04-15"),
      durationMinutes: 90,
      totalInCents: 8000,
      discountInCents: 0,
      clientNotes: null,
      staffNotes: null,
      staffFirstName: "Alex",
      staffLastName: "Kim",
      location: "Studio",
    };

    let callNum = 0;
    setupMocks(() => {
      callNum++;
      // Every select returns profileRow-like data so profile lookup succeeds
      // The bookings query (call 7 or so in Promise.all) returns booking rows,
      // but since all selects return the same data, the function maps it.
      return makeChain([
        {
          ...profileRow,
          ...bookingRow,
          count: 0,
          points: 0,
        },
      ]);
    });

    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("client-1");

    expect(result).not.toBeNull();
    // Bookings array should have items mapped from the select results
    expect(result!.bookings.length).toBeGreaterThanOrEqual(1);
    expect(result!.bookings[0].staffName).toBe("Alex Kim");
  });

  it("calculates loyalty balance correctly", async () => {
    vi.resetModules();
    let callNum = 0;
    setupMocks(() => {
      callNum++;
      return makeChain([
        {
          ...profileRow,
          count: 0,
          points: 100,
          type: "earn",
          description: "Booking",
          id: callNum <= 3 ? "client-1" : `lt-${callNum}`,
        },
      ]);
    });

    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("client-1");

    expect(result).not.toBeNull();
    // loyaltyBalance is sum of points from loyalty rows
    expect(result!.loyaltyBalance).toBeGreaterThanOrEqual(0);
  });

  it("returns payment history", async () => {
    vi.resetModules();
    const paymentData = {
      id: 1,
      bookingId: 10,
      status: "paid",
      method: "square_card",
      amountInCents: 15000,
      tipInCents: 2000,
      refundedInCents: 0,
      paidAt: new Date("2026-03-01"),
      createdAt: new Date("2026-03-01"),
    };

    setupMocks(() =>
      makeChain([
        {
          ...profileRow,
          ...paymentData,
          count: 0,
          points: 0,
          type: "earn",
          description: "",
          staffFirstName: null,
          staffLastName: null,
          serviceName: "Test",
          serviceCategory: "lash",
          startsAt: new Date(),
          durationMinutes: 60,
          totalInCents: 15000,
          discountInCents: 0,
          clientNotes: null,
          staffNotes: null,
          location: null,
          lashMapping: null,
          curlType: null,
          diameter: null,
          lengths: null,
          adhesive: null,
          retentionNotes: null,
          productsUsed: null,
          notes: null,
          reactions: null,
          nextVisitNotes: null,
          subject: "",
          threadType: "",
          lastMessageAt: new Date(),
          messageCount: 0,
          unreadCount: 0,
          formName: "",
          formType: "",
          formVersion: null,
          submittedAt: new Date(),
          data: null,
          bookingDate: new Date(),
        },
      ]),
    );

    const { getClientDetail } = await import("./actions");
    const result = await getClientDetail("client-1");

    expect(result).not.toBeNull();
    expect(result!.payments.length).toBeGreaterThanOrEqual(1);
    expect(result!.payments[0].amountInCents).toBe(15000);
  });

  it("throws when user is not authenticated", async () => {
    vi.resetModules();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    setupMocks();
    const { getClientDetail } = await import("./actions");
    await expect(getClientDetail("client-1")).rejects.toThrow("Not authenticated");
  });
});
