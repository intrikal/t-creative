/**
 * app/dashboard/analytics/actions.ts — Barrel re-export for analytics actions.
 *
 * All analytics functions have been split into domain-specific modules.
 * This file re-exports everything for backward compatibility so that
 * existing imports like `import { getKpiStats } from "./actions"` still work.
 *
 * No queries live here — see the individual sub-modules for SQL-level docs:
 *   - revenue-actions.ts           — KPIs, revenue trends, service revenue, per-hour heatmap
 *   - booking-analytics-actions.ts — booking trends, service mix, attendance, peak times
 *   - client-analytics-actions.ts  — retention, at-risk, sources, lifetime value, visit freq
 *   - business-analytics-actions.ts — staff perf, promo ROI, membership value, gift card breakage
 *
 * @module analytics/actions
 * @see {@link ./AnalyticsPage.tsx} — client component consuming this data
 */
// Shared types
export type { Range } from "./_shared";

// Revenue analytics
export type {
  KpiStats,
  WeeklyRevenue,
  ServiceRevenueItem,
  RevenuePerHourDay,
} from "./revenue-actions";
export {
  getKpiStats,
  getRevenueTrend,
  getRevenueByService,
  getRevenuePerHour,
  getRevenueGoal,
} from "./revenue-actions";

// Booking analytics
export type {
  WeeklyBookings,
  ServiceMixItem,
  AttendanceStats,
  PeakTimeSlot,
  AppointmentGapStats,
  CheckoutRebookStats,
  TopService,
  BookingExportRow,
} from "./booking-analytics-actions";
export {
  getBookingsTrend,
  getServiceMix,
  getAttendanceStats,
  getPeakTimes,
  getAppointmentGaps,
  getCheckoutRebookRate,
  getTopServices,
  exportBookingsCsv,
} from "./booking-analytics-actions";

// Client analytics
export type {
  RetentionWeek,
  AtRiskClient,
  ClientSourceItem,
  ClientLifetimeValue,
  VisitFrequencyBucket,
  RebookRate,
  CancellationReasonItem,
} from "./client-analytics-actions";
export {
  getRetentionTrend,
  getAtRiskClients,
  getClientSources,
  getClientLifetimeValues,
  getVisitFrequency,
  getRebookRates,
  getCancellationReasons,
} from "./client-analytics-actions";

// Business analytics
export type {
  StaffPerformanceItem,
  PromotionRoiItem,
  MembershipValueStats,
  GiftCardBreakageStats,
  WaitlistConversionStats,
} from "./business-analytics-actions";
export {
  getStaffPerformance,
  getPromotionRoi,
  getMembershipValue,
  getGiftCardBreakage,
  getWaitlistConversion,
} from "./business-analytics-actions";

// Revenue forecast
export type { RevenueForecastData, ForecastDataPoint } from "./forecast-actions";
export { getRevenueForecast } from "./forecast-actions";

// Referral stats
export type { ReferralStats } from "./referral-actions";
export { getReferralStats } from "./referral-actions";
