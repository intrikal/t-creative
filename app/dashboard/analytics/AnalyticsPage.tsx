/**
 * Analytics dashboard shell — header, range picker, and composed sections.
 *
 * **DB-wired** (via props from `page.tsx`):
 * - KPI stat cards, revenue trend, bookings trend, service mix
 * - Staff performance, attendance, retention, at-risk clients
 * - Top services, rebooking rates, peak times
 *
 * **Hardcoded** (no DB schema):
 * - Client sources (in `ServicesAndSources`)
 * - Revenue goal (in `RevenueSection`)
 *
 * Each visual section is extracted into its own component under `./components/`.
 *
 * @module analytics/AnalyticsPage
 * @see {@link ./actions.ts} — server actions providing props
 * @see {@link ./page.tsx} — Server Component data fetcher
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  KpiStats,
  WeeklyBookings,
  WeeklyRevenue,
  ServiceMixItem,
  StaffPerformanceItem,
  AttendanceStats,
  RetentionWeek,
  AtRiskClient,
  TopService,
  RebookRate,
  PeakTimeSlot,
  ClientSourceItem,
  ClientLifetimeValue,
  CancellationReasonItem,
  AppointmentGapStats,
} from "./actions";
import { AppointmentGapSection } from "./components/AppointmentGapSection";
import { AttendanceSection } from "./components/AttendanceSection";
import { BookingsSection } from "./components/BookingsSection";
import { CancellationReasonsSection } from "./components/CancellationReasonsSection";
import { ClientLtvSection } from "./components/ClientLtvSection";
import { KpiCards } from "./components/KpiCards";
import { PeakTimesSection } from "./components/PeakTimes";
import { RetentionSection } from "./components/RetentionSection";
import { RevenueSection } from "./components/RevenueSection";
import { ServicesAndSources } from "./components/ServicesAndSources";
import { StaffPerformanceSection } from "./components/StaffPerformance";

const RANGES = ["7d", "30d", "90d", "12m"] as const;
type Range = (typeof RANGES)[number];

export function AnalyticsPage({
  kpiStats,
  bookingsTrend,
  revenueTrend,
  serviceMix,
  staffPerformance,
  attendanceStats,
  retentionTrend,
  atRiskClients,
  topServices,
  rebookRates,
  peakTimes,
  clientSources,
  revenueGoal,
  clientLtv,
  cancellationReasons,
  appointmentGaps,
}: {
  kpiStats: KpiStats;
  bookingsTrend: WeeklyBookings[];
  revenueTrend: WeeklyRevenue[];
  serviceMix: ServiceMixItem[];
  staffPerformance: StaffPerformanceItem[];
  attendanceStats: AttendanceStats;
  retentionTrend: RetentionWeek[];
  atRiskClients: AtRiskClient[];
  topServices: TopService[];
  rebookRates: RebookRate[];
  peakTimes: { byHour: PeakTimeSlot[]; byDay: PeakTimeSlot[] };
  clientSources: ClientSourceItem[];
  revenueGoal: number;
  clientLtv: ClientLifetimeValue[];
  cancellationReasons: CancellationReasonItem[];
  appointmentGaps: AppointmentGapStats;
}) {
  const [range, setRange] = useState<Range>("30d");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Analytics</h1>
          <p className="text-sm text-muted mt-0.5">Trends, insights, and performance</p>
        </div>
        <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                range === r ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <KpiCards stats={kpiStats} />
      <RevenueSection
        revenueTrend={revenueTrend}
        revenueMtd={kpiStats.revenueMtd}
        revenueGoal={revenueGoal}
      />
      <BookingsSection bookingsTrend={bookingsTrend} serviceMix={serviceMix} />
      <StaffPerformanceSection staff={staffPerformance} />
      <AttendanceSection attendance={attendanceStats} rebookRates={rebookRates} />
      <CancellationReasonsSection reasons={cancellationReasons} />
      <RetentionSection retentionTrend={retentionTrend} atRiskClients={atRiskClients} />
      <AppointmentGapSection data={appointmentGaps} />
      <ClientLtvSection clients={clientLtv} />
      <ServicesAndSources topServices={topServices} clientSources={clientSources} />
      <PeakTimesSection byHour={peakTimes.byHour} byDay={peakTimes.byDay} />
    </div>
  );
}
