import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import type { Range } from "@/lib/types/analytics.types";
import { AnalyticsShell } from "./AnalyticsShell";
import { AppointmentGapSectionWrapper } from "./sections/AppointmentGapSectionWrapper";
import { BookingsSectionWrapper } from "./sections/BookingsSectionWrapper";
import { CheckoutRebookSectionWrapper } from "./sections/CheckoutRebookSectionWrapper";
import { ClientsSection } from "./sections/ClientsSection";
import { GiftCardBreakageSectionWrapper } from "./sections/GiftCardBreakageSectionWrapper";
import { KpiSection } from "./sections/KpiSection";
import { MembershipValueSectionWrapper } from "./sections/MembershipValueSectionWrapper";
import { OperationalSection } from "./sections/OperationalSection";
import { PeakTimesSectionWrapper } from "./sections/PeakTimesSectionWrapper";
import { PromotionRoiSectionWrapper } from "./sections/PromotionRoiSectionWrapper";
import { ReferralStatsSectionWrapper } from "./sections/ReferralStatsSectionWrapper";
import { RetentionSectionWrapper } from "./sections/RetentionSectionWrapper";
import { RevenueByServiceSectionWrapper } from "./sections/RevenueByServiceSectionWrapper";
import { RevenueForecastSectionWrapper } from "./sections/RevenueForecastSectionWrapper";
import { RevenuePerHourSectionWrapper } from "./sections/RevenuePerHourSectionWrapper";
import { RevenueSectionWrapper } from "./sections/RevenueSectionWrapper";
import { StaffSection } from "./sections/StaffSection";
import { VisitFrequencySectionWrapper } from "./sections/VisitFrequencySectionWrapper";
import { WaitlistConversionSectionWrapper } from "./sections/WaitlistConversionSectionWrapper";

export const metadata: Metadata = {
  title: "Insights — T Creative Studio",
  description: "View studio analytics, performance metrics, and insights.",
  robots: { index: false, follow: false },
};

const VALID_RANGES: Range[] = ["7d", "30d", "90d", "12m"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const { range: rawRange } = await searchParams;
  const range: Range = VALID_RANGES.includes(rawRange as Range) ? (rawRange as Range) : "30d";

  return (
    <AnalyticsShell
      kpis={<KpiSection range={range} />}
      overview={
        <div className="space-y-4">
          <RevenueSectionWrapper range={range} />
          <BookingsSectionWrapper range={range} />
          <ClientsSection range={range} />
        </div>
      }
      revenue={
        <div className="space-y-4">
          <RevenueSectionWrapper range={range} />
          <RevenueByServiceSectionWrapper range={range} />
          <RevenuePerHourSectionWrapper range={range} />
          <RevenueForecastSectionWrapper />
        </div>
      }
      bookings={
        <div className="space-y-4">
          <BookingsSectionWrapper range={range} />
          <PeakTimesSectionWrapper range={range} />
          <AppointmentGapSectionWrapper range={range} />
          <CheckoutRebookSectionWrapper range={range} />
          <WaitlistConversionSectionWrapper range={range} />
        </div>
      }
      clients={
        <div className="space-y-4">
          <ClientsSection range={range} />
          <RetentionSectionWrapper range={range} />
          <VisitFrequencySectionWrapper range={range} />
          <ReferralStatsSectionWrapper />
        </div>
      }
      team={
        <div className="space-y-4">
          <StaffSection range={range} />
          <OperationalSection range={range} />
        </div>
      }
      marketing={
        <div className="space-y-4">
          <PromotionRoiSectionWrapper range={range} />
          <MembershipValueSectionWrapper range={range} />
          <GiftCardBreakageSectionWrapper range={range} />
        </div>
      }
    />
  );
}
