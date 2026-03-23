/**
 * lib/types/analytics.types.ts
 * Shared types for all analytics dashboard sections.
 * Sources: app/dashboard/analytics/_shared.ts,
 *          revenue-actions.ts, booking-analytics-actions.ts,
 *          business-analytics-actions.ts, client-analytics-actions.ts
 */

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

export type Range = "7d" | "30d" | "90d" | "12m";

/* ------------------------------------------------------------------ */
/*  Revenue analytics                                                  */
/* ------------------------------------------------------------------ */

export type KpiStats = {
  revenueMtd: number;
  bookingCount: number;
  newClients: number;
  noShowRate: number;
  fillRate: number;
  avgTicket: number;
  revenueMtdDelta: number | null;
  bookingCountDelta: number | null;
  newClientsDelta: number | null;
  noShowRateDelta: number | null;
  fillRateDelta: number | null;
  avgTicketDelta: number | null;
};

export type WeeklyRevenue = {
  week: string;
  revenue: number;
};

export type ServiceRevenueItem = {
  service: string;
  category: string;
  revenue: number;
  bookings: number;
  pct: number;
};

export type RevenuePerHourDay = {
  day: string;
  isoDay: number;
  revenue: number;
  availableHours: number;
  revenuePerHour: number;
};

/* ------------------------------------------------------------------ */
/*  Booking analytics                                                  */
/* ------------------------------------------------------------------ */

export type WeeklyBookings = {
  week: string;
  lash: number;
  jewelry: number;
  crochet: number;
  consulting: number;
};

export type ServiceMixItem = {
  label: string;
  pct: number;
  count: number;
};

export type AttendanceStats = {
  completed: number;
  noShow: number;
  cancelled: number;
  total: number;
  revenueLost: number;
};

export type PeakTimeSlot = {
  label: string;
  load: number;
};

export type AppointmentGapStats = {
  overall: number | null;
  byCategory: { category: string; avgDays: number }[];
};

export type CheckoutRebookStats = {
  overallRate: number;
  totalCompleted: number;
  totalRebooked: number;
  byStaff: {
    name: string;
    completed: number;
    rebooked: number;
    rate: number;
  }[];
  byCategory: {
    category: string;
    completed: number;
    rebooked: number;
    rate: number;
  }[];
};

export type TopService = {
  service: string;
  bookings: number;
  revenue: number;
};

export type BookingExportRow = {
  date: string;
  client: string;
  service: string;
  status: string;
  durationMin: number;
  priceUsd: string;
  staff: string;
  notes: string;
};

/* ------------------------------------------------------------------ */
/*  Business analytics                                                 */
/* ------------------------------------------------------------------ */

export type StaffPerformanceItem = {
  name: string;
  role: string;
  avatar: string;
  bookings: number;
  revenue: number;
  avgTicket: number;
  utilization: number;
  serviceRecordCompletion: number;
};

export type PromotionRoiItem = {
  code: string;
  description: string | null;
  discountType: string;
  bookings: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  roi: number;
};

export type MembershipValueStats = {
  memberAvgSpend: number;
  nonMemberAvgSpend: number;
  spendLift: number;
  avgLifetimeDays: number | null;
  monthlyChurnRate: number;
  activeCount: number;
  cancelledCount: number;
  byPlan: {
    plan: string;
    active: number;
    cancelled: number;
    avgSpend: number;
    avgLifetimeDays: number | null;
    churnRate: number;
  }[];
};

export type GiftCardBreakageStats = {
  totalSold: number;
  totalOriginalValue: number;
  totalRedeemed: number;
  totalRemaining: number;
  breakageRate: number;
  byStatus: {
    status: string;
    count: number;
    originalValue: number;
    remaining: number;
  }[];
  aging: {
    label: string;
    count: number;
    remaining: number;
  }[];
};

export type WaitlistConversionStats = {
  totalEntries: number;
  totalNotified: number;
  totalBooked: number;
  totalExpired: number;
  totalCancelled: number;
  totalWaiting: number;
  conversionRate: number;
  expiryRate: number;
  avgWaitDays: number | null;
  avgClaimHours: number | null;
  byService: {
    service: string;
    entries: number;
    booked: number;
    expired: number;
    conversionRate: number;
    avgWaitDays: number | null;
  }[];
  weeklyTrend: {
    week: string;
    joined: number;
    booked: number;
    expired: number;
  }[];
};

/* ------------------------------------------------------------------ */
/*  Client analytics                                                   */
/* ------------------------------------------------------------------ */

export type RetentionWeek = {
  week: string;
  newClients: number;
  returning: number;
};

export type AtRiskClient = {
  name: string;
  lastVisit: string;
  daysSince: number;
  service: string;
  urgency: "high" | "medium" | "low";
};

export type ClientSourceItem = {
  source: string;
  count: number;
  pct: number;
};

export type ClientLifetimeValue = {
  clientId: string;
  name: string;
  totalSpend: number;
  transactionCount: number;
};

export type VisitFrequencyBucket = {
  label: string;
  clients: number;
  pct: number;
};

export type RebookRate = {
  service: string;
  rate: number;
};

export type CancellationReasonItem = {
  reason: string;
  count: number;
  pct: number;
};

/* ------------------------------------------------------------------ */
/*  Revenue forecast                                                   */
/* ------------------------------------------------------------------ */

export type ForecastDataPoint = {
  /** Label like "Apr 5" */
  label: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Confirmed upcoming booking revenue (cumulative, cents) */
  confirmed: number;
  /** Confirmed + projected recurring revenue (cumulative, cents) */
  recurring: number;
  /** Confirmed + recurring + membership renewal revenue (cumulative, cents) */
  total: number;
  /** Lower confidence bound (cumulative, cents) */
  low: number;
  /** Upper confidence bound (cumulative, cents) */
  high: number;
};

export type RevenueForecastData = {
  points: ForecastDataPoint[];
  /** Historical completion rate used for confidence bands */
  completionRate: number;
  /** Summary totals at 30/60/90 day marks (cents) */
  milestones: {
    days: number;
    confirmed: number;
    recurring: number;
    membership: number;
    total: number;
    low: number;
    high: number;
  }[];
};

/* ------------------------------------------------------------------ */
/*  Staff performance dashboard                                        */
/* ------------------------------------------------------------------ */

export type StaffKpi = {
  staffId: string;
  name: string;
  avatar: string;
  role: string;
  bookingsWeek: number;
  bookingsMonth: number;
  bookingsAllTime: number;
  revenue: number;
  avgActualMinutes: number | null;
  avgScheduledMinutes: number | null;
  durationDelta: number | null;
  retentionRate: number | null;
  noShowRate: number;
  avgRating: number | null;
  reviewCount: number;
  commissionThisPeriod: number;
  commissionThisMonth: number;
  commissionType: "percentage" | "flat_fee";
  commissionRate: number;
  flatFeeInCents: number;
  tipSplitPercent: number;
};
