import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import type { Range } from "@/lib/types/analytics.types";
import { AnalyticsShell, INSIGHTS_TABS, type InsightsTab } from "./AnalyticsShell";
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

function TabContent({ tab, range }: { tab: InsightsTab; range: Range }) {
  switch (tab) {
    case "Overview":
      return (
        <div className="space-y-4">
          <RevenueSectionWrapper range={range} />
          <BookingsSectionWrapper range={range} />
          <ClientsSection range={range} />
        </div>
      );
    case "Revenue":
      return (
        <div className="space-y-4">
          <RevenueSectionWrapper range={range} />
          <RevenueByServiceSectionWrapper range={range} />
          <RevenuePerHourSectionWrapper range={range} />
          <RevenueForecastSectionWrapper />
        </div>
      );
    case "Bookings":
      return (
        <div className="space-y-4">
          <BookingsSectionWrapper range={range} />
          <PeakTimesSectionWrapper range={range} />
          <AppointmentGapSectionWrapper range={range} />
          <CheckoutRebookSectionWrapper range={range} />
          <WaitlistConversionSectionWrapper range={range} />
        </div>
      );
    case "Clients":
      return (
        <div className="space-y-4">
          <ClientsSection range={range} />
          <RetentionSectionWrapper range={range} />
          <VisitFrequencySectionWrapper range={range} />
          <ReferralStatsSectionWrapper />
        </div>
      );
    case "Team":
      return (
        <div className="space-y-4">
          <StaffSection range={range} />
          <OperationalSection range={range} />
        </div>
      );
    case "Marketing":
      return (
        <div className="space-y-4">
          <PromotionRoiSectionWrapper range={range} />
          <MembershipValueSectionWrapper range={range} />
          <GiftCardBreakageSectionWrapper range={range} />
        </div>
      );
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const { range: rawRange, tab: rawTab } = await searchParams;
  const range: Range = VALID_RANGES.includes(rawRange as Range) ? (rawRange as Range) : "30d";
  const tab: InsightsTab = (INSIGHTS_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as InsightsTab)
    : "Overview";

  return (
    <AnalyticsShell
      kpis={<KpiSection range={range} />}
      tabContent={<TabContent tab={tab} range={range} />}
      activeTab={tab}
    />
  );
}
