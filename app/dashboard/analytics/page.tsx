/**
 * Analytics dashboard route — `/dashboard/analytics`.
 *
 * Server Component that fetches 11 datasets in parallel from the `bookings`,
 * `payments`, `services`, and `profiles` tables (via `./actions.ts`) and
 * passes them as serialised props to the `<AnalyticsPage>` Client Component.
 *
 * Client sources and revenue goal remain hardcoded (no DB schema).
 *
 * @module analytics/page
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./AnalyticsPage.tsx} — client component
 */

import {
  getKpiStats,
  getBookingsTrend,
  getRevenueTrend,
  getServiceMix,
  getStaffPerformance,
  getAttendanceStats,
  getRetentionTrend,
  getAtRiskClients,
  getTopServices,
  getRebookRates,
  getPeakTimes,
  getClientSources,
  getRevenueGoal,
  getClientLifetimeValues,
  getCancellationReasons,
  getAppointmentGaps,
} from "./actions";
import { AnalyticsPage } from "./AnalyticsPage";

export default async function Page() {
  // Batch queries to avoid exhausting the Supabase connection pool
  const [kpiStats, bookingsTrend, revenueTrend, serviceMix, staffPerformance] = await Promise.all([
    getKpiStats(),
    getBookingsTrend(),
    getRevenueTrend(),
    getServiceMix(),
    getStaffPerformance(),
  ]);

  const [attendanceStats, retentionTrend, atRiskClients, topServices, rebookRates] =
    await Promise.all([
      getAttendanceStats(),
      getRetentionTrend(),
      getAtRiskClients(),
      getTopServices(),
      getRebookRates(),
    ]);

  const [peakTimes, clientSources, revenueGoal, clientLtv, cancellationReasons] = await Promise.all(
    [
      getPeakTimes(),
      getClientSources(),
      getRevenueGoal(),
      getClientLifetimeValues(),
      getCancellationReasons(),
    ],
  );

  const appointmentGaps = await getAppointmentGaps();

  return (
    <AnalyticsPage
      kpiStats={kpiStats}
      bookingsTrend={bookingsTrend}
      revenueTrend={revenueTrend}
      serviceMix={serviceMix}
      staffPerformance={staffPerformance}
      attendanceStats={attendanceStats}
      retentionTrend={retentionTrend}
      atRiskClients={atRiskClients}
      topServices={topServices}
      rebookRates={rebookRates}
      peakTimes={peakTimes}
      clientSources={clientSources}
      revenueGoal={revenueGoal}
      clientLtv={clientLtv}
      cancellationReasons={cancellationReasons}
      appointmentGaps={appointmentGaps}
    />
  );
}
