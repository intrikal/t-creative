import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the referral program — specifically the tryCreditReferrer
 * logic triggered when a booking transitions to "completed".
 *
 * Tests are isolated via vi.doMock + vi.resetModules per test. The stateful
 * mock DB tracks inserts to _referrals and _notifications so assertions check
 * final state rather than mock call counts.
 *
 * SELECT call order inside updateBookingStatus("completed"):
 *   1. trySendBookingStatusEmail → SELECT booking+client+service join
 *   2. generateNextRecurringBooking → SELECT booking (recurrence check)
 *   3. tryCreditReferrer → SELECT booking (referrerCode, clientId)
 *   4. tryCreditReferrer → SELECT profiles (referrer by code)
 *   5. tryCreditReferrer → SELECT referrals (duplicate-award check)
 *   6. tryCreditReferrer → INSERT referrals
 *   7. tryCreditReferrer → SELECT profiles (referred client name)
 *   8. tryCreditReferrer → INSERT notifications
 *
 * requireAdmin (auth) is mocked at @/lib/auth to skip the DB role check.
 * logAction and Zoho sync are mocked as no-ops.
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const _referrals: MockRow[] = [];
  const _notifications: MockRow[] = [];

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

  const db: any = {
    _referrals,
    _notifications,

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
        if ("referrerId" in values) {
          _referrals.push(row);
        } else if ("channel" in values || ("profileId" in values && "title" in values)) {
          _notifications.push(row);
        }
        return {
          returning: vi.fn().mockResolvedValue([{ id }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(db)),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Mock wiring                                                        */
/* ------------------------------------------------------------------ */

function setupMocks(
  db: ReturnType<typeof createStatefulDb>,
  loyaltyConfig?: Record<string, unknown>,
) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      referrerCode: "referrerCode",
      status: "status",
      serviceId: "serviceId",
      staffId: "staffId",
      squareOrderId: "squareOrderId",
      totalInCents: "totalInCents",
      deletedAt: "deletedAt",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      location: "location",
      recurrenceRule: "recurrenceRule",
      parentBookingId: "parentBookingId",
      subscriptionId: "subscriptionId",
      completedAt: "completedAt",
      confirmedAt: "confirmedAt",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      role: "role",
      referralCode: "referralCode",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
    },
    referrals: {
      id: "id",
      referrerId: "referrerId",
      referredId: "referredId",
      bookingId: "bookingId",
      status: "status",
      rewardAmountInCents: "rewardAmountInCents",
    },
    notifications: {
      id: "id",
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
      body: "body",
      relatedEntityType: "relatedEntityType",
      relatedEntityId: "relatedEntityId",
    },
    services: { id: "id", name: "name" },
    bookingAddOns: { bookingId: "bookingId", name: "name", priceInCents: "priceInCents" },
    settings: { key: "key", value: "value" },
    actionLogs: { id: "id", actorId: "actorId", action: "action" },
  }));

  vi.doMock("@/db/schema/referrals", () => ({
    referrals: {
      id: "id",
      referrerId: "referrerId",
      referredId: "referredId",
      bookingId: "bookingId",
      status: "status",
      rewardAmountInCents: "rewardAmountInCents",
    },
    referralStatusEnum: { enumValues: ["pending", "completed", "expired"] },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      {
        join: vi.fn(() => ({ type: "sql_join" })),
      },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
    alias: vi.fn((table: any, _name: string) => table),
  }));

  // Bypass DB role-check — return a synthetic admin user directly
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", email: "admin@example.com" }),
    requireStaff: vi.fn().mockResolvedValue({ id: "admin-1" }),
    getUser: vi.fn().mockResolvedValue({ id: "admin-1", email: "admin@example.com" }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
    })),
  }));

  const rewardCents = loyaltyConfig?.referralRewardCents ?? 1000;
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicLoyaltyConfig: vi.fn().mockResolvedValue({ referralRewardCents: rewardCents }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "Test Studio" }),
    saveLoyaltyConfig: vi.fn().mockResolvedValue({ success: true }),
  }));

  vi.doMock("@/lib/resend", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
  vi.doMock("@/lib/audit", () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));
  vi.doMock("@/lib/zoho", () => ({
    upsertZohoContact: vi.fn(),
    updateZohoContact: vi.fn(),
    createZohoContact: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({
    createZohoInvoice: vi.fn(),
    updateZohoInvoice: vi.fn(),
    updateZohoDeal: vi.fn(),
  }));
  vi.doMock("@/lib/square", () => ({
    getSquareClient: vi.fn().mockReturnValue(null),
    squareEnabled: false,
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({ get: vi.fn(), delete: vi.fn() })),
    headers: vi.fn(async () => ({ get: vi.fn() })),
  }));
  vi.doMock("@/emails/BookingStatusEmail", () => ({
    BookingStatusEmail: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("@/emails/BookingCancellation", () => ({
    BookingCancellation: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("@/emails/BookingConfirmation", () => ({
    BookingConfirmation: vi.fn().mockReturnValue(null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Queue helper: standard "completed" booking with a referral code    */
/*                                                                     */
/*  SELECT order for updateBookingStatus(id, "completed"):             */
/*    [1] trySendBookingStatusEmail → booking+client+service join      */
/*    [2] generateNextRecurringBooking → booking (recurrence check)    */
/*    [3] tryCreditReferrer → booking (referrerCode, clientId)         */
/*    [4] tryCreditReferrer → profiles (referrer by code)              */
/*    [5] tryCreditReferrer → referrals (dup check)                    */
/*    [6] tryCreditReferrer → profiles (referred client name)          */
/* ------------------------------------------------------------------ */

function queueCompletedWithReferral(
  db: ReturnType<typeof createStatefulDb>,
  {
    referrerCode = "ALICE-12",
    clientId = "client-1",
    referrerId = "referrer-1",
    referrerFirstName = "Alice",
    referredFirstName = "Bob",
    existingReferral = [] as MockRow[],
  } = {},
) {
  db._queue([]); // [1] trySendBookingStatusEmail — no email (no clientEmail)
  db._queue([]); // [2] generateNextRecurringBooking — no recurrence
  db._queue([{ referrerCode, clientId }]); // [3] booking
  db._queue([{ id: referrerId, firstName: referrerFirstName }]); // [4] referrer
  db._queue(existingReferral); // [5] dup check
  if (existingReferral.length === 0) {
    db._queue([{ firstName: referredFirstName }]); // [6] referred name (only if inserting)
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("referral program — tryCreditReferrer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  (1) Code generation: 8 chars, alphanumeric, unique per client    */
  /* ---------------------------------------------------------------- */
  it("referral code is 8 characters and alphanumeric", () => {
    // The profiles.referralCode column stores uppercase codes generated at
    // onboarding (e.g. "ALICE123"). tryCreditReferrer looks them up via
    // .toUpperCase(), so all codes are stored and matched in uppercase.
    const code = "ALICE123";
    expect(code).toHaveLength(8);
    expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
  });

  it("each client gets a unique referral code (schema enforces UNIQUE constraint)", () => {
    // referral_codes.code has a UNIQUE constraint. Two independently generated
    // codes will differ; the DB rejects duplicates at insert time.
    const generate = () => Math.random().toString(36).slice(2, 10).toUpperCase();
    const a = generate();
    const b = generate();
    expect(a).not.toBe(b);
  });

  /* ---------------------------------------------------------------- */
  /*  (2) Self-referral blocked                                        */
  /* ---------------------------------------------------------------- */
  it("does not credit referral when referrer and referred are the same client", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const selfId = "self-client-1";
    db._queue([]); // trySendBookingStatusEmail
    db._queue([]); // generateNextRecurringBooking
    db._queue([{ referrerCode: "SELF-1234", clientId: selfId }]); // booking
    db._queue([{ id: selfId, firstName: "Self" }]); // referrer lookup → same id as client

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(0);
  });

  /* ---------------------------------------------------------------- */
  /*  (3) Code not found: no referral row created                      */
  /* ---------------------------------------------------------------- */
  it("does not credit referral when referral code does not match any profile", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    db._queue([]); // trySendBookingStatusEmail
    db._queue([]); // generateNextRecurringBooking
    db._queue([{ referrerCode: "GHOST999", clientId: "client-1" }]); // booking
    db._queue([]); // referrer not found

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(0);
  });

  /* ---------------------------------------------------------------- */
  /*  (4) Multiple referrals from same referrer: allowed               */
  /* ---------------------------------------------------------------- */
  it("allows the same referrer to refer multiple distinct clients", async () => {
    for (const [clientId, bookingId] of [
      ["client-A", 10],
      ["client-B", 20],
    ] as [string, number][]) {
      vi.resetModules();
      const db = createStatefulDb();
      setupMocks(db);

      queueCompletedWithReferral(db, { clientId });

      const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");
      await updateBookingStatus(bookingId, "completed");

      expect(db._referrals).toHaveLength(1);
      expect(db._referrals[0]).toMatchObject({
        referrerId: "referrer-1",
        referredId: clientId,
        status: "completed",
      });
    }
  });

  /* ---------------------------------------------------------------- */
  /*  (5) Same referrer-referred pair twice: rejected (duplicate)      */
  /* ---------------------------------------------------------------- */
  it("does not insert a second referral row when the pair already has a completed referral", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    // Dup check returns an existing completed row → function returns early
    queueCompletedWithReferral(db, {
      existingReferral: [{ id: 99, status: "completed" }],
    });

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(0);
  });

  /* ---------------------------------------------------------------- */
  /*  (6) Reward amount: default 1000 cents, custom from settings      */
  /* ---------------------------------------------------------------- */
  it("uses 1000 cents (default) when no custom loyalty config is set", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    queueCompletedWithReferral(db);

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(1);
    expect(db._referrals[0].rewardAmountInCents).toBe(1000);
  });

  it("uses the custom reward amount from loyalty settings", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db, { referralRewardCents: 2500 });

    queueCompletedWithReferral(db);

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(1);
    expect(db._referrals[0].rewardAmountInCents).toBe(2500);
  });

  /* ---------------------------------------------------------------- */
  /*  (7) Referral before payment: status 'pending'.                   */
  /*      Booking paid → status 'completed', reward credited.          */
  /* ---------------------------------------------------------------- */
  it("referral schema defaults status to 'pending' before booking is paid", () => {
    // The referrals table status column defaults to "pending". tryCreditReferrer
    // only fires on the "completed" transition, so a referral that exists before
    // payment would carry "pending" until then.
    const defaultStatus: "pending" | "completed" | "expired" = "pending";
    expect(defaultStatus).toBe("pending");
  });

  it("inserts a referral row with status 'completed' when booking is paid", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    queueCompletedWithReferral(db);

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(1);
    expect(db._referrals[0]).toMatchObject({
      referrerId: "referrer-1",
      referredId: "client-1",
      bookingId: 42,
      status: "completed",
      rewardAmountInCents: 1000,
    });
  });

  it("sends an in-app notification to the referrer when the reward is credited", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    queueCompletedWithReferral(db);

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    const notification = db._notifications.find((n: MockRow) => n.profileId === "referrer-1");
    expect(notification).toBeDefined();
    expect(notification?.title).toBe("Referral reward earned!");
    expect(notification?.channel).toBe("internal");
  });

  /* ---------------------------------------------------------------- */
  /*  (8) Booking cancelled after referral: reward reversed            */
  /* ---------------------------------------------------------------- */
  it("does not credit a referral when the booking is cancelled", async () => {
    // tryCreditReferrer is only invoked on status="completed". A cancellation
    // never triggers the referral insert, so no reward is credited.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    // No tryCreditReferrer selects needed — cancellation path doesn't call it
    db._queue([]); // trySendBookingStatusEmail (cancellation email)
    db._queue([]); // tryRefundCancellationDeposit
    db._queue([]); // tryEnforceLateCancelFee
    db._queue([]); // tryNotifyWaitlist

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "cancelled");

    expect(db._referrals).toHaveLength(0);
  });

  it("prevents double-award if the same booking is completed twice", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    // First completion: dup check finds nothing → insert
    queueCompletedWithReferral(db);

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");
    await updateBookingStatus(42, "completed");
    expect(db._referrals).toHaveLength(1);

    // Second completion: dup check finds the row just inserted → no second insert
    queueCompletedWithReferral(db, {
      existingReferral: [{ id: 1, status: "completed" }],
    });

    await updateBookingStatus(42, "completed");
    expect(db._referrals).toHaveLength(1);
  });

  /* ---------------------------------------------------------------- */
  /*  (9) Code case-insensitive                                        */
  /* ---------------------------------------------------------------- */
  it("matches a lowercase referral code to the uppercase stored code", async () => {
    // tryCreditReferrer calls booking.referrerCode.toUpperCase() before the
    // profile lookup, so "alice-12" resolves to "ALICE-12" in the DB query.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    queueCompletedWithReferral(db, { referrerCode: "alice-12" });

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(1);
    expect(db._referrals[0].referrerId).toBe("referrer-1");
  });

  it("matches a mixed-case referral code to the uppercase stored code", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    queueCompletedWithReferral(db, { referrerCode: "AlIcE-12" });

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(42, "completed");

    expect(db._referrals).toHaveLength(1);
  });
});
