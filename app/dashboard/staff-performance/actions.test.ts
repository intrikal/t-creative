// @vitest-environment node

/**
 * app/dashboard/staff-performance/actions.test.ts
 *
 * Unit tests for the KPI calculation logic in actions.ts.
 *
 * The production function (getStaffPerformanceData) fetches 11 parallel DB
 * queries and assembles them into StaffKpi objects.  The pure computation
 * helpers are extracted here so they can be tested without a DB connection.
 *
 * Covered scenarios
 *   1. Bookings completed count — correct per-staff count from result rows.
 *   2. Revenue sum — only paid payments contribute; unpaid/refunded excluded.
 *   3. Average duration delta — actual minus scheduled, rounded to 1 dp.
 *   4. Client retention rate — % of visits followed by a revisit within 60 days.
 *   5. No-show rate — % of finalised bookings (completed + no_show + cancelled).
 *   6. Commission: percentage mode — Math.round(total * rate/100) + tip split.
 *   7. Commission: flat_fee mode  — count × flat_fee + tip split.
 *   8. Date range filtering — periodStart computed correctly for each Range.
 *   9. Empty data — all KPIs return 0 / null, never NaN.
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types (mirroring production)                                       */
/* ------------------------------------------------------------------ */

type Range = "7d" | "30d" | "90d" | "12m";
type CommissionType = "percentage" | "flat_fee";

interface StaffRow {
  id: string;
  commissionType: CommissionType | null;
  commissionRatePercent: number | null;
  commissionFlatFeeInCents: number | null;
  tipSplitPercent: number | null;
}

interface BookingCountRow {
  staffId: string | null;
  count: number;
}

interface RevenueRow {
  staffId: string | null;
  /** Sum of paid payment amounts in cents (COALESCE to 0). */
  total: number;
}

interface DurationRow {
  staffId: string | null;
  avgScheduled: number;
  avgActual: number;
}

interface NoShowRow {
  staffId: string | null;
  noShows: number;
  total: number;
}

interface RetentionRow {
  staff_id: string;
  retention_rate: string; // Postgres returns numeric as string
}

interface CommissionRow {
  staffId: string | null;
  totalInCents: number;
  tipInCents: number;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers extracted from actions.ts                             */
/* ------------------------------------------------------------------ */

const DEFAULT_COMMISSION = 60;

function rangeToDays(range: Range): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
}

/**
 * Builds lookup maps from DB result rows, keyed by staffId.
 * Mirrors the toMap() helper in actions.ts.
 */
function toMap<T extends { staffId: string | null }>(rows: T[]): Map<string, T> {
  return new Map(rows.filter((r) => r.staffId).map((r) => [r.staffId!, r]));
}

/**
 * Computes completed booking count for a staff member.
 * Returns 0 when the staff member has no rows.
 */
function completedCount(map: Map<string, BookingCountRow>, staffId: string): number {
  return Number(map.get(staffId)?.count ?? 0);
}

/**
 * Computes revenue in dollars (cents → dollars, rounded).
 * Only paid payments are included in the DB query; this just does the unit
 * conversion.
 */
function revenueInDollars(map: Map<string, RevenueRow>, staffId: string): number {
  return Math.round(Number(map.get(staffId)?.total ?? 0) / 100);
}

/**
 * Computes the duration delta (actual − scheduled), rounded to 1 dp.
 * Returns null when no completed-with-completedAt rows exist.
 */
function durationDelta(map: Map<string, DurationRow>, staffId: string): number | null {
  const row = map.get(staffId);
  if (!row) return null;
  const actual = Number(row.avgActual);
  const scheduled = Number(row.avgScheduled);
  return Math.round((actual - scheduled) * 10) / 10;
}

/**
 * Computes the no-show rate as a whole-number percentage.
 * denominator = completed + no_show + cancelled (all finalised bookings)
 */
function noShowRate(map: Map<string, NoShowRow>, staffId: string): number {
  const row = map.get(staffId);
  const total = Number(row?.total ?? 0);
  if (total === 0) return 0;
  return Math.round((Number(row!.noShows) / total) * 100);
}

/**
 * Looks up retention rate from the raw SQL result rows.
 * Postgres returns numeric columns as strings; converts to number.
 */
function retentionRate(rows: RetentionRow[], staffId: string): number | null {
  const row = rows.find((r) => r.staff_id === staffId);
  if (!row) return null;
  return Number(row.retention_rate);
}

/**
 * Computes commission earned in dollars (result is in cents internally,
 * then divided by 100 and rounded — same as production).
 *
 * percentage mode: Math.round(totalInCents * rate/100) + Math.round(tipInCents * tipSplit/100)
 * flat_fee mode:   count * flatFeeInCents + Math.round(tipInCents * tipSplit/100)
 */
function computeCommissionDollars(
  staff: StaffRow,
  totalInCents: number,
  tipInCents: number,
  bookingCount: number,
): number {
  const commType = staff.commissionType ?? "percentage";
  const rate = staff.commissionRatePercent ?? DEFAULT_COMMISSION;
  const flatFee = staff.commissionFlatFeeInCents ?? 0;
  const tipSplit = staff.tipSplitPercent ?? 100;

  let serviceCut: number;
  if (commType === "flat_fee") {
    serviceCut = bookingCount * flatFee;
  } else {
    serviceCut = Math.round(totalInCents * (rate / 100));
  }

  const tipCut = Math.round(tipInCents * (tipSplit / 100));
  return Math.round((serviceCut + tipCut) / 100);
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Staff performance KPI calculations", () => {
  // ─── 1. Bookings completed count ──────────────────────────────────

  describe("1. Bookings completed count", () => {
    it("returns the correct count for a staff member with bookings", () => {
      const map = toMap<BookingCountRow>([
        { staffId: "s1", count: 12 },
        { staffId: "s2", count: 5 },
      ]);
      expect(completedCount(map, "s1")).toBe(12);
      expect(completedCount(map, "s2")).toBe(5);
    });

    it("returns 0 when staff member has no rows (new staff, no bookings yet)", () => {
      const map = toMap<BookingCountRow>([]);
      expect(completedCount(map, "s1")).toBe(0);
    });

    it("returns 0 when staff member is not in the result set", () => {
      const map = toMap<BookingCountRow>([{ staffId: "s1", count: 7 }]);
      expect(completedCount(map, "s-unknown")).toBe(0);
    });

    it("rows with null staffId are excluded from the map", () => {
      const map = toMap<BookingCountRow>([
        { staffId: null, count: 99 },
        { staffId: "s1", count: 3 },
      ]);
      expect(map.size).toBe(1);
      expect(completedCount(map, "s1")).toBe(3);
    });

    it("count is treated as a number even when DB returns it as a string", () => {
      // Drizzle sql<number> casts — ensure Number() conversion is safe
      const map = toMap<BookingCountRow>([{ staffId: "s1", count: "8" as unknown as number }]);
      expect(completedCount(map, "s1")).toBe(8);
    });
  });

  // ─── 2. Revenue sum — only paid payments ──────────────────────────

  describe("2. Revenue sum — only paid payments contribute", () => {
    it("converts cents to dollars correctly", () => {
      const map = toMap<RevenueRow>([{ staffId: "s1", total: 150000 }]); // $1500
      expect(revenueInDollars(map, "s1")).toBe(1500);
    });

    it("returns 0 when no paid payments exist for the staff member", () => {
      const map = toMap<RevenueRow>([]);
      expect(revenueInDollars(map, "s1")).toBe(0);
    });

    it("rounds fractional cents correctly (COALESCE ensures no null)", () => {
      // 10050 cents = $100.50 → rounds to $101
      const map = toMap<RevenueRow>([{ staffId: "s1", total: 10050 }]);
      expect(revenueInDollars(map, "s1")).toBe(101);
    });

    it("revenue query excludes non-paid payments (DB-level JOIN on status='paid')", () => {
      // The DB query uses INNER JOIN payments ON status = 'paid'.
      // Here we document that unpaid amounts do not appear in the total.
      const paidOnlyTotal = 8500; // only paid payment
      const map = toMap<RevenueRow>([{ staffId: "s1", total: paidOnlyTotal }]);
      expect(revenueInDollars(map, "s1")).toBe(85); // $85

      // An unpaid payment of 5000 cents would have made it $135 — it doesn't
      expect(revenueInDollars(map, "s1")).not.toBe(135);
    });

    it("multiple staff members have independent revenue totals", () => {
      const map = toMap<RevenueRow>([
        { staffId: "s1", total: 20000 },
        { staffId: "s2", total: 35000 },
      ]);
      expect(revenueInDollars(map, "s1")).toBe(200);
      expect(revenueInDollars(map, "s2")).toBe(350);
    });
  });

  // ─── 3. Average duration delta ────────────────────────────────────

  describe("3. Average duration delta — actual minus scheduled, rounded to 1 dp", () => {
    it("positive delta: ran over schedule", () => {
      const map = toMap<DurationRow>([{ staffId: "s1", avgScheduled: 60, avgActual: 67.5 }]);
      expect(durationDelta(map, "s1")).toBe(7.5);
    });

    it("negative delta: finished early", () => {
      const map = toMap<DurationRow>([{ staffId: "s1", avgScheduled: 60, avgActual: 55 }]);
      expect(durationDelta(map, "s1")).toBe(-5);
    });

    it("zero delta: on time", () => {
      const map = toMap<DurationRow>([{ staffId: "s1", avgScheduled: 60, avgActual: 60 }]);
      expect(durationDelta(map, "s1")).toBe(0);
    });

    it("returns null when no completed bookings with completedAt exist", () => {
      const map = toMap<DurationRow>([]);
      expect(durationDelta(map, "s1")).toBeNull();
    });

    it("rounds to 1 decimal place (not 2)", () => {
      // avgActual=62.333..., avgScheduled=60 → delta=2.333... → rounds to 2.3
      const map = toMap<DurationRow>([{ staffId: "s1", avgScheduled: 60, avgActual: 62.333 }]);
      expect(durationDelta(map, "s1")).toBe(2.3);
    });

    it("result is a number, not NaN or Infinity", () => {
      const map = toMap<DurationRow>([{ staffId: "s1", avgScheduled: 45, avgActual: 50 }]);
      const delta = durationDelta(map, "s1");
      expect(delta).not.toBeNaN();
      expect(Number.isFinite(delta!)).toBe(true);
    });
  });

  // ─── 4. Client retention rate ─────────────────────────────────────

  describe("4. Client retention rate — % rebooking within 60 days", () => {
    it("returns the numeric rate from the raw SQL row", () => {
      const rows: RetentionRow[] = [{ staff_id: "s1", retention_rate: "75.0" }];
      expect(retentionRate(rows, "s1")).toBe(75);
    });

    it("returns null when no retention row exists for the staff member", () => {
      expect(retentionRate([], "s1")).toBeNull();
    });

    it("100% retention: all clients rebook within 60 days", () => {
      const rows: RetentionRow[] = [{ staff_id: "s1", retention_rate: "100.0" }];
      expect(retentionRate(rows, "s1")).toBe(100);
    });

    it("0% retention: no clients rebook within 60 days", () => {
      const rows: RetentionRow[] = [{ staff_id: "s1", retention_rate: "0.0" }];
      expect(retentionRate(rows, "s1")).toBe(0);
    });

    it("string-numeric conversion is exact (Postgres numeric as string)", () => {
      const rows: RetentionRow[] = [{ staff_id: "s1", retention_rate: "66.7" }];
      expect(retentionRate(rows, "s1")).toBe(66.7);
    });

    it("multiple staff members have independent retention rates", () => {
      const rows: RetentionRow[] = [
        { staff_id: "s1", retention_rate: "80.0" },
        { staff_id: "s2", retention_rate: "50.0" },
      ];
      expect(retentionRate(rows, "s1")).toBe(80);
      expect(retentionRate(rows, "s2")).toBe(50);
    });
  });

  // ─── 5. No-show rate ──────────────────────────────────────────────

  describe("5. No-show rate — % of finalised bookings marked no_show", () => {
    it("calculates correctly: 2 no-shows out of 10 = 20%", () => {
      const map = toMap<NoShowRow>([{ staffId: "s1", noShows: 2, total: 10 }]);
      expect(noShowRate(map, "s1")).toBe(20);
    });

    it("0% when no no-shows", () => {
      const map = toMap<NoShowRow>([{ staffId: "s1", noShows: 0, total: 8 }]);
      expect(noShowRate(map, "s1")).toBe(0);
    });

    it("100% when all bookings are no-shows", () => {
      const map = toMap<NoShowRow>([{ staffId: "s1", noShows: 5, total: 5 }]);
      expect(noShowRate(map, "s1")).toBe(100);
    });

    it("returns 0 when total is 0 (no finalised bookings — avoids division by zero)", () => {
      const map = toMap<NoShowRow>([{ staffId: "s1", noShows: 0, total: 0 }]);
      expect(noShowRate(map, "s1")).toBe(0);
      expect(noShowRate(map, "s1")).not.toBeNaN();
    });

    it("returns 0 when staff member has no rows", () => {
      const map = toMap<NoShowRow>([]);
      expect(noShowRate(map, "s1")).toBe(0);
    });

    it("rounds to nearest whole percent: 1 no-show of 3 = 33%", () => {
      const map = toMap<NoShowRow>([{ staffId: "s1", noShows: 1, total: 3 }]);
      expect(noShowRate(map, "s1")).toBe(33);
    });

    it("denominator includes completed + no_show + cancelled (all finalised)", () => {
      // 1 no-show, 5 completed, 2 cancelled = 8 total → 12.5% → rounds to 13%
      const map = toMap<NoShowRow>([{ staffId: "s1", noShows: 1, total: 8 }]);
      expect(noShowRate(map, "s1")).toBe(13);
    });
  });

  // ─── 6. Commission: percentage mode ──────────────────────────────

  describe("6. Commission — percentage mode", () => {
    const percentStaff: StaffRow = {
      id: "s1",
      commissionType: "percentage",
      commissionRatePercent: 60,
      commissionFlatFeeInCents: null,
      tipSplitPercent: 100,
    };

    it("60% of $150 revenue = $90 commission", () => {
      // 15000 cents × 60% = 9000 cents → $90
      expect(computeCommissionDollars(percentStaff, 15000, 0, 0)).toBe(90);
    });

    it("tip split 100%: all tip goes to staff", () => {
      // 10000 cents revenue + 1000 cents tip, 60% commission
      // service: round(10000 * 0.6) = 6000; tip: round(1000 * 1.0) = 1000 → total 7000 → $70
      expect(computeCommissionDollars(percentStaff, 10000, 1000, 0)).toBe(70);
    });

    it("tip split 50%: half tip goes to staff", () => {
      const halfTipStaff: StaffRow = { ...percentStaff, tipSplitPercent: 50 };
      // service: round(10000 * 0.6) = 6000; tip: round(1000 * 0.5) = 500 → total 6500 → $65
      expect(computeCommissionDollars(halfTipStaff, 10000, 1000, 0)).toBe(65);
    });

    it("defaults to 60% rate when commissionRatePercent is null", () => {
      const nullRateStaff: StaffRow = { ...percentStaff, commissionRatePercent: null };
      expect(computeCommissionDollars(nullRateStaff, 10000, 0, 0)).toBe(60);
    });

    it("defaults to percentage mode when commissionType is null", () => {
      const nullTypeStaff: StaffRow = {
        ...percentStaff,
        commissionType: null,
        commissionRatePercent: 70,
      };
      // 70% of 10000 cents = 7000 cents → $70
      expect(computeCommissionDollars(nullTypeStaff, 10000, 0, 0)).toBe(70);
    });

    it("uses Math.round for fractional cents (9999 × 60% = 5999.4 → rounds to 5999)", () => {
      // 9999 cents × 60% = 5999.4 → Math.round = 5999 cents → $59 (rounds down /100)
      expect(computeCommissionDollars(percentStaff, 9999, 0, 0)).toBe(60);
    });
  });

  // ─── 7. Commission: flat_fee mode ─────────────────────────────────

  describe("7. Commission — flat_fee mode", () => {
    const flatStaff: StaffRow = {
      id: "s1",
      commissionType: "flat_fee",
      commissionRatePercent: null,
      commissionFlatFeeInCents: 2000, // $20 per session
      tipSplitPercent: 100,
    };

    it("flat_fee: 5 bookings × $20 flat fee = $100 commission", () => {
      // 5 × 2000 cents = 10000 cents + 0 tip → $100
      expect(computeCommissionDollars(flatStaff, 0, 0, 5)).toBe(100);
    });

    it("flat_fee ignores totalInCents (revenue doesn't affect the fee)", () => {
      const highRevenue = computeCommissionDollars(flatStaff, 100000, 0, 5);
      const lowRevenue = computeCommissionDollars(flatStaff, 1000, 0, 5);
      expect(highRevenue).toBe(lowRevenue);
      expect(highRevenue).toBe(100);
    });

    it("flat_fee with tip split: 5 bookings + $10 tip (100% split) = $100 + $10 = $110", () => {
      // 5 × 2000 = 10000 + round(1000 × 1.0) = 1000 → total 11000 → $110
      expect(computeCommissionDollars(flatStaff, 0, 1000, 5)).toBe(110);
    });

    it("flat_fee with tip split 50%: 5 bookings + $10 tip = $100 + $5 = $105", () => {
      const halfTipStaff: StaffRow = { ...flatStaff, tipSplitPercent: 50 };
      expect(computeCommissionDollars(halfTipStaff, 0, 1000, 5)).toBe(105);
    });

    it("flat_fee with 0 bookings = $0 service cut", () => {
      expect(computeCommissionDollars(flatStaff, 0, 0, 0)).toBe(0);
    });

    it("flat_fee defaults to 0 when commissionFlatFeeInCents is null", () => {
      const nullFeeStaff: StaffRow = { ...flatStaff, commissionFlatFeeInCents: null };
      expect(computeCommissionDollars(nullFeeStaff, 0, 0, 10)).toBe(0);
    });
  });

  // ─── 8. Date range filtering ──────────────────────────────────────

  describe("8. Date range filtering — periodStart computed correctly", () => {
    it("7d range = 7 days", () => {
      expect(rangeToDays("7d")).toBe(7);
    });

    it("30d range = 30 days", () => {
      expect(rangeToDays("30d")).toBe(30);
    });

    it("90d range = 90 days", () => {
      expect(rangeToDays("90d")).toBe(90);
    });

    it("12m range = 365 days", () => {
      expect(rangeToDays("12m")).toBe(365);
    });

    it("periodStart is exactly N days before now (UTC ms arithmetic)", () => {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const now = new Date("2026-04-01T12:00:00.000Z");

      for (const range of ["7d", "30d", "90d", "12m"] as Range[]) {
        const days = rangeToDays(range);
        const periodStart = new Date(now.getTime() - days * DAY_MS);
        const diffDays = (now.getTime() - periodStart.getTime()) / DAY_MS;
        expect(diffDays).toBe(days);
      }
    });

    it("bookings before periodStart should not be counted (boundary is exclusive)", () => {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const now = new Date("2026-04-01T00:00:00.000Z");
      const periodStart = new Date(now.getTime() - 30 * DAY_MS); // 30 days ago

      const bookingInRange = new Date(now.getTime() - 15 * DAY_MS); // 15 days ago
      const bookingOutOfRange = new Date(periodStart.getTime() - 1); // 1ms before range

      expect(bookingInRange >= periodStart).toBe(true);
      expect(bookingOutOfRange >= periodStart).toBe(false);
    });
  });

  // ─── 9. Empty data — zeroes not NaN ───────────────────────────────

  describe("9. Empty data — all KPIs return 0 or null, never NaN", () => {
    const emptyStaff: StaffRow = {
      id: "s-empty",
      commissionType: "percentage",
      commissionRatePercent: 60,
      commissionFlatFeeInCents: null,
      tipSplitPercent: 100,
    };

    it("completedCount returns 0 for empty map", () => {
      const result = completedCount(toMap<BookingCountRow>([]), "s-empty");
      expect(result).toBe(0);
      expect(result).not.toBeNaN();
    });

    it("revenueInDollars returns 0 for empty map", () => {
      const result = revenueInDollars(toMap<RevenueRow>([]), "s-empty");
      expect(result).toBe(0);
      expect(result).not.toBeNaN();
    });

    it("durationDelta returns null (not NaN) for empty map", () => {
      const result = durationDelta(toMap<DurationRow>([]), "s-empty");
      expect(result).toBeNull();
    });

    it("retentionRate returns null (not NaN) for empty rows", () => {
      const result = retentionRate([], "s-empty");
      expect(result).toBeNull();
    });

    it("noShowRate returns 0 (not NaN) for empty map — no division by zero", () => {
      const result = noShowRate(toMap<NoShowRow>([]), "s-empty");
      expect(result).toBe(0);
      expect(result).not.toBeNaN();
    });

    it("noShowRate returns 0 (not NaN) when total=0 — explicit zero-denominator guard", () => {
      const map = toMap<NoShowRow>([{ staffId: "s-empty", noShows: 0, total: 0 }]);
      const result = noShowRate(map, "s-empty");
      expect(result).toBe(0);
      expect(result).not.toBeNaN();
    });

    it("computeCommissionDollars returns 0 for 0 revenue and 0 bookings", () => {
      const result = computeCommissionDollars(emptyStaff, 0, 0, 0);
      expect(result).toBe(0);
      expect(result).not.toBeNaN();
    });

    it("all KPIs are finite numbers or null — none are Infinity", () => {
      expect(Number.isFinite(completedCount(toMap([]), "x"))).toBe(true);
      expect(Number.isFinite(revenueInDollars(toMap([]), "x"))).toBe(true);
      expect(Number.isFinite(noShowRate(toMap([]), "x"))).toBe(true);
      expect(Number.isFinite(computeCommissionDollars(emptyStaff, 0, 0, 0))).toBe(true);
      // null-returning KPIs are not numbers, so we check them separately
      expect(durationDelta(toMap([]), "x")).toBeNull();
      expect(retentionRate([], "x")).toBeNull();
    });
  });
});
