/**
 * @file admin-home-queries.test.ts
 * Unit tests for the admin dashboard query functions.
 *
 * Covers:
 *  getAdminStatsAndAlerts — returns correct stats shape
 *  getAdminStatsAndAlerts — revenue sums cents correctly
 *  getAdminStatsAndAlerts — low stock count aggregates products + supplies
 *  getAdminStatsAndAlerts — overdue invoice alert built correctly
 *  getAdminStatsAndAlerts — today's appointments count
 *  getAdminStatsAndAlerts — empty DB returns zero-value stats with no crash
 *  getAdminTodayBookings — returns mapped booking shape
 *  getAdminTodayBookings — empty DB returns empty array
 *  getAdminInquiries — returns mapped inquiry shape
 *  getAdminWeeklyRevenue — returns 7-day array with zero-fill
 *  getAdminRecentClientsAndTeam — returns recentClients and teamToday arrays
 */
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

/**
 * getAdminStatsAndAlerts issues exactly 12 db.select() calls across three
 * batched Promise.all groups (in order):
 *
 * Batch 1a (4):  revToday, revYesterday, activeClientsMonth, remainingToday
 * Batch 1b (5):  newClientsWeek, waitlist, outstanding, openInquiries, newInquiriesToday
 * Batch 2  (3):  overdueInvoices (array!), lowStockProducts, lowStockSupplies
 */
interface StatsRows {
  revToday?: number;
  revYesterday?: number;
  activeClients?: number;
  remainingToday?: number;
  newClients?: number;
  waitlistTotal?: number;
  waitlistNotContacted?: number;
  outstandingCents?: number;
  outstandingCnt?: number;
  openInquiries?: number;
  newInquiriesToday?: number;
  overdueInvoices?: unknown[];
  lowStockProducts?: number;
  lowStockSupplies?: number;
}

function makeStatsResponses({
  revToday = 0,
  revYesterday = 0,
  activeClients = 0,
  remainingToday = 0,
  newClients = 0,
  waitlistTotal = 0,
  waitlistNotContacted = 0,
  outstandingCents = 0,
  outstandingCnt = 0,
  openInquiries = 0,
  newInquiriesToday = 0,
  overdueInvoices = [] as unknown[],
  lowStockProducts = 0,
  lowStockSupplies = 0,
}: StatsRows = {}): unknown[][] {
  return [
    [{ total: revToday }],          // 1  revToday
    [{ total: revYesterday }],       // 2  revYesterday
    [{ count: activeClients }],      // 3  activeClientsMonth
    [{ count: remainingToday }],     // 4  remainingToday
    [{ count: newClients }],         // 5  newClientsWeek
    [{ total: waitlistTotal, notContacted: waitlistNotContacted }], // 6 waitlist
    [{ total: outstandingCents, cnt: outstandingCnt }],             // 7 outstanding
    [{ count: openInquiries }],      // 8  openInquiries
    [{ count: newInquiriesToday }],  // 9  newInquiriesToday
    overdueInvoices,                 // 10 overdueInvoices (direct array)
    [{ count: lowStockProducts }],   // 11 lowStockProducts
    [{ count: lowStockSupplies }],   // 12 lowStockSupplies
  ];
}

function setupMocks(selectResponses: unknown[][] = []) {
  let callCount = 0;
  vi.doMock("@/db", () => ({
    db: {
      select: vi.fn(() => makeChain(selectResponses[callCount++] ?? [])),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    assistantProfiles: { profileId: "profileId", title: "title" },
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      status: "status",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      location: "location",
      locationId: "locationId",
      depositPaidInCents: "depositPaidInCents",
    },
    inquiries: {
      id: "id",
      name: "name",
      interest: "interest",
      message: "message",
      status: "status",
      createdAt: "createdAt",
    },
    invoices: {
      id: "id",
      number: "number",
      clientId: "clientId",
      amountInCents: "amountInCents",
      dueAt: "dueAt",
      status: "status",
    },
    payments: {
      id: "id",
      amountInCents: "amountInCents",
      status: "status",
      paidAt: "paidAt",
      createdAt: "createdAt",
      bookingId: "bookingId",
    },
    products: {
      id: "id",
      availability: "availability",
      stockCount: "stockCount",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      role: "role",
      source: "source",
      isVip: "isVip",
      isActive: "isActive",
      createdAt: "createdAt",
    },
    services: { id: "id", name: "name", category: "category" },
    shifts: {
      assistantId: "assistantId",
      startsAt: "startsAt",
      endsAt: "endsAt",
      status: "status",
    },
    supplies: { id: "id", stockCount: "stockCount", reorderPoint: "reorderPoint" },
    waitlist: { id: "id", status: "status", notifiedAt: "notifiedAt" },
  }));
  vi.doMock("drizzle-orm", () => ({
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    count: vi.fn(() => ({ type: "count" })),
    countDistinct: vi.fn(() => ({ type: "countDistinct" })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    gt: vi.fn((...args: unknown[]) => ({ type: "gt", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ type: "isNotNull", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    sum: vi.fn(() => ({ type: "sum" })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("react", () => ({
    cache: (fn: unknown) => fn,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("admin-home-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- getAdminStatsAndAlerts ---- */

  describe("getAdminStatsAndAlerts", () => {
    it("returns zero-value stats and empty alerts for an empty database", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses());
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      expect(result.stats.revenueTodayCents).toBe(0);
      expect(result.stats.appointmentsToday).toBe(0);
      expect(result.stats.activeClientsThisMonth).toBe(0);
      expect(result.stats.newClientsThisWeek).toBe(0);
      expect(result.stats.waitlistTotal).toBe(0);
      expect(result.stats.outstandingCents).toBe(0);
      expect(result.stats.openInquiries).toBe(0);
      expect(result.lowStockCount).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it("converts revenue cents to the correct dollar-level cent value", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ revToday: 15000, revYesterday: 10000 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      expect(result.stats.revenueTodayCents).toBe(15000);
    });

    it("calculates revenueTodayVsYesterdayPct correctly", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ revToday: 15000, revYesterday: 10000 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      // (15000 - 10000) / 10000 * 100 = 50
      expect(result.stats.revenueTodayVsYesterdayPct).toBe(50);
    });

    it("returns null pct when yesterday had no revenue", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ revToday: 5000, revYesterday: 0 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      expect(result.stats.revenueTodayVsYesterdayPct).toBeNull();
    });

    it("aggregates low stock count from both products and supplies", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ lowStockProducts: 2, lowStockSupplies: 1 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      expect(result.lowStockCount).toBe(3);
      expect(result.stats.lowStockProducts).toBe(2);
      expect(result.stats.lowStockSupplies).toBe(1);
    });

    it("builds a warning alert when low stock count is greater than zero", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ lowStockProducts: 1 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      const alert = result.alerts.find((a) => a.id === "low-stock");
      expect(alert).toBeDefined();
      expect(alert?.type).toBe("warning");
      expect(alert?.href).toBe("/dashboard/marketplace");
    });

    it("builds a single overdue-invoice error alert for one overdue invoice", async () => {
      vi.resetModules();
      const dueAt = new Date("2026-03-15");
      setupMocks(
        makeStatsResponses({
          overdueInvoices: [
            {
              id: 7,
              number: "INV-007",
              amountInCents: 20000,
              dueAt,
              clientFirstName: "Jane",
              clientLastName: "Doe",
            },
          ],
        }),
      );
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      const alert = result.alerts.find((a) => a.id === "overdue-7");
      expect(alert).toBeDefined();
      expect(alert?.type).toBe("error");
      expect(alert?.message).toContain("INV-007");
      expect(alert?.message).toContain("Jane Doe");
      expect(alert?.href).toBe("/dashboard/financial");
    });

    it("builds a multi-invoice error alert when more than one invoice is overdue", async () => {
      vi.resetModules();
      setupMocks(
        makeStatsResponses({
          overdueInvoices: [
            { id: 1, number: "INV-001", amountInCents: 10000, dueAt: new Date(), clientFirstName: "A", clientLastName: "B" },
            { id: 2, number: "INV-002", amountInCents: 20000, dueAt: new Date(), clientFirstName: "C", clientLastName: "D" },
          ],
        }),
      );
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      const alert = result.alerts.find((a) => a.id === "overdue-multiple");
      expect(alert).toBeDefined();
      expect(alert?.message).toContain("2 invoices");
      expect(alert?.message).toContain("$300");
    });

    it("reflects remainingToday count in appointmentsToday stat", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ remainingToday: 4 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      expect(result.stats.appointmentsToday).toBe(4);
      expect(result.stats.appointmentsRemaining).toBe(4);
    });

    it("builds a waitlist info alert when clients are waiting", async () => {
      vi.resetModules();
      setupMocks(makeStatsResponses({ waitlistTotal: 3, waitlistNotContacted: 1 }));
      const { getAdminStatsAndAlerts } = await import("./admin-home-queries");
      const result = await getAdminStatsAndAlerts();
      const alert = result.alerts.find((a) => a.id === "waitlist");
      expect(alert).toBeDefined();
      expect(alert?.type).toBe("info");
      expect(alert?.message).toContain("3");
      expect(alert?.message).toContain("1 not yet contacted");
    });
  });

  /* ---- getAdminTodayBookings ---- */

  describe("getAdminTodayBookings", () => {
    it("returns empty todayBookings array when no bookings exist", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getAdminTodayBookings } = await import("./admin-home-queries");
      const result = await getAdminTodayBookings();
      expect(result.todayBookings).toEqual([]);
    });

    it("maps raw DB rows to the AdminBooking display shape", async () => {
      vi.resetModules();
      setupMocks([
        [
          {
            id: 1,
            startsAt: new Date("2026-04-12T10:00:00"),
            durationMinutes: 90,
            status: "confirmed",
            location: "Studio A",
            clientFirstName: "Jane",
            clientLastName: "Doe",
            staffFirstName: "Morgan",
            serviceName: "Classic Full Set",
            serviceCategory: "lash",
          },
        ],
      ]);
      const { getAdminTodayBookings } = await import("./admin-home-queries");
      const result = await getAdminTodayBookings();
      expect(result.todayBookings).toHaveLength(1);
      const booking = result.todayBookings[0];
      expect(booking.id).toBe(1);
      expect(booking.client).toBe("Jane Doe");
      expect(booking.clientInitials).toBe("JD");
      expect(booking.service).toBe("Classic Full Set");
      expect(booking.staff).toBe("Morgan");
      expect(booking.status).toBe("confirmed");
      expect(booking.durationMin).toBe(90);
      expect(booking.location).toBe("Studio A");
    });

    it("uses '—' for staff when staffFirstName is null", async () => {
      vi.resetModules();
      setupMocks([
        [
          {
            id: 2,
            startsAt: new Date("2026-04-12T11:00:00"),
            durationMinutes: 60,
            status: "pending",
            location: null,
            clientFirstName: "Sam",
            clientLastName: "Lee",
            staffFirstName: null,
            serviceName: "Consultation",
            serviceCategory: "consulting",
          },
        ],
      ]);
      const { getAdminTodayBookings } = await import("./admin-home-queries");
      const result = await getAdminTodayBookings();
      expect(result.todayBookings[0].staff).toBe("—");
    });
  });

  /* ---- getAdminInquiries ---- */

  describe("getAdminInquiries", () => {
    it("returns empty array when no inquiries exist", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getAdminInquiries } = await import("./admin-home-queries");
      const result = await getAdminInquiries();
      expect(result.inquiries).toEqual([]);
    });

    it("maps raw inquiry rows to the AdminInquiry display shape", async () => {
      vi.resetModules();
      setupMocks([
        [
          {
            id: 5,
            name: "Alice Brown",
            interest: "lash",
            message: "I'd like to book a full set.",
            status: "new",
            createdAt: new Date("2026-04-12T08:00:00Z"),
          },
        ],
      ]);
      const { getAdminInquiries } = await import("./admin-home-queries");
      const result = await getAdminInquiries();
      expect(result.inquiries).toHaveLength(1);
      const inquiry = result.inquiries[0];
      expect(inquiry.id).toBe(5);
      expect(inquiry.name).toBe("Alice Brown");
      expect(inquiry.initials).toBe("AB");
      expect(inquiry.status).toBe("new");
    });
  });

  /* ---- getAdminWeeklyRevenue ---- */

  describe("getAdminWeeklyRevenue", () => {
    it("returns a 7-entry array filling zero for days with no payments", async () => {
      vi.resetModules();
      // call 1: weeklyRevDailyRaw (direct array), call 2: priorWeekRevRow (.then)
      setupMocks([[], [{ total: 0 }]]);
      const { getAdminWeeklyRevenue } = await import("./admin-home-queries");
      const result = await getAdminWeeklyRevenue();
      expect(result.weeklyRevenue).toHaveLength(7);
      expect(result.weeklyRevenue.every((d) => d.amount === 0)).toBe(true);
    });

    it("converts daily totals from cents to dollars", async () => {
      vi.resetModules();
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setupMocks([[{ dateStr, total: 25000 }], [{ total: 0 }]]);
      const { getAdminWeeklyRevenue } = await import("./admin-home-queries");
      const result = await getAdminWeeklyRevenue();
      const todayEntry = result.weeklyRevenue.find((d) => d.day === "Today");
      expect(todayEntry?.amount).toBe(250);
    });

    it("returns null weeklyRevenueVsPriorPct when prior week had zero revenue", async () => {
      vi.resetModules();
      setupMocks([[], [{ total: 0 }]]);
      const { getAdminWeeklyRevenue } = await import("./admin-home-queries");
      const result = await getAdminWeeklyRevenue();
      expect(result.weeklyRevenueVsPriorPct).toBeNull();
    });
  });

  /* ---- getAdminRecentClientsAndTeam ---- */

  describe("getAdminRecentClientsAndTeam", () => {
    it("returns empty arrays when database is empty", async () => {
      vi.resetModules();
      // 3 parallel selects: recentClients, teamShifts, clientCategories
      setupMocks([[], [], []]);
      const { getAdminRecentClientsAndTeam } = await import("./admin-home-queries");
      const result = await getAdminRecentClientsAndTeam();
      expect(result.recentClients).toEqual([]);
      expect(result.teamToday).toEqual([]);
    });

    it("maps recent client rows to the AdminClient display shape", async () => {
      vi.resetModules();
      setupMocks([
        [
          {
            id: "c-1",
            firstName: "Jane",
            lastName: "Doe",
            source: "instagram",
            isVip: false,
            createdAt: new Date(Date.now() - 3600_000),
          },
        ],
        [],
        [],
      ]);
      const { getAdminRecentClientsAndTeam } = await import("./admin-home-queries");
      const result = await getAdminRecentClientsAndTeam();
      expect(result.recentClients).toHaveLength(1);
      const client = result.recentClients[0];
      expect(client.id).toBe("c-1");
      expect(client.name).toBe("Jane Doe");
      expect(client.initials).toBe("JD");
      expect(client.vip).toBe(false);
    });

    it("deduplicates team shifts by assistantId", async () => {
      vi.resetModules();
      const start = new Date("2026-04-12T09:00:00");
      const end = new Date("2026-04-12T17:00:00");
      const shiftRow = {
        assistantId: "asst-1",
        shiftStart: start,
        shiftEnd: end,
        shiftStatus: "scheduled",
        firstName: "Morgan",
        lastName: "Lee",
        title: "Lash Artist",
      };
      // Two rows for same assistant — should deduplicate to one
      setupMocks([[], [shiftRow, shiftRow], []]);
      const { getAdminRecentClientsAndTeam } = await import("./admin-home-queries");
      const result = await getAdminRecentClientsAndTeam();
      expect(result.teamToday).toHaveLength(1);
      expect(result.teamToday[0].name).toBe("Morgan Lee");
      expect(result.teamToday[0].status).toBe("active");
    });
  });
});
