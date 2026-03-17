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
import type { Range } from "./actions";

const VALID_RANGES: Range[] = ["7d", "30d", "90d", "12m"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: Range = VALID_RANGES.includes(rawRange as Range)
    ? (rawRange as Range)
    : "30d";

  return (
    <AnalyticsShell>
      <KpiSection />
      <RevenueSectionWrapper range={range} />
      <RevenueByServiceSectionWrapper range={range} />
      <RevenuePerHourSectionWrapper range={range} />
      <BookingsSectionWrapper range={range} />
      <StaffSection range={range} />
      <OperationalSection range={range} />
      <CheckoutRebookSectionWrapper range={range} />
      <RetentionSectionWrapper range={range} />
      <VisitFrequencySectionWrapper />
      <AppointmentGapSectionWrapper />
      <ClientsSection range={range} />
      <PromotionRoiSectionWrapper />
      <MembershipValueSectionWrapper />
      <GiftCardBreakageSectionWrapper />
      <PeakTimesSectionWrapper range={range} />
    </AnalyticsShell>
  );
}
