import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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
import { RetentionSectionWrapper } from "./sections/RetentionSectionWrapper";
import { RevenueByServiceSectionWrapper } from "./sections/RevenueByServiceSectionWrapper";
import { RevenuePerHourSectionWrapper } from "./sections/RevenuePerHourSectionWrapper";
import { RevenueSectionWrapper } from "./sections/RevenueSectionWrapper";
import { StaffSection } from "./sections/StaffSection";
import { VisitFrequencySectionWrapper } from "./sections/VisitFrequencySectionWrapper";
import { WaitlistConversionSectionWrapper } from "./sections/WaitlistConversionSectionWrapper";
import type { Range } from "@/lib/types/analytics.types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics — T Creative Studio",
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
  const range: Range = VALID_RANGES.includes(rawRange as Range)
    ? (rawRange as Range)
    : "30d";

  return (
    <AnalyticsShell>
      <KpiSection range={range} />
      <RevenueSectionWrapper range={range} />
      <RevenueByServiceSectionWrapper range={range} />
      <RevenuePerHourSectionWrapper range={range} />
      <BookingsSectionWrapper range={range} />
      <StaffSection range={range} />
      <OperationalSection range={range} />
      <CheckoutRebookSectionWrapper range={range} />
      <RetentionSectionWrapper range={range} />
      <VisitFrequencySectionWrapper range={range} />
      <AppointmentGapSectionWrapper range={range} />
      <ClientsSection range={range} />
      <WaitlistConversionSectionWrapper range={range} />
      <PromotionRoiSectionWrapper range={range} />
      <MembershipValueSectionWrapper range={range} />
      <GiftCardBreakageSectionWrapper range={range} />
      <PeakTimesSectionWrapper range={range} />
    </AnalyticsShell>
  );
}
