import { AnalyticsShell } from "./AnalyticsShell";
import { AppointmentGapSectionWrapper } from "./sections/AppointmentGapSectionWrapper";
import { BookingsSectionWrapper } from "./sections/BookingsSectionWrapper";
import { CheckoutRebookSectionWrapper } from "./sections/CheckoutRebookSectionWrapper";
import { ClientsSection } from "./sections/ClientsSection";
import { KpiSection } from "./sections/KpiSection";
import { OperationalSection } from "./sections/OperationalSection";
import { PeakTimesSectionWrapper } from "./sections/PeakTimesSectionWrapper";
import { PromotionRoiSectionWrapper } from "./sections/PromotionRoiSectionWrapper";
import { RetentionSectionWrapper } from "./sections/RetentionSectionWrapper";
import { RevenueByServiceSectionWrapper } from "./sections/RevenueByServiceSectionWrapper";
import { RevenueSectionWrapper } from "./sections/RevenueSectionWrapper";
import { StaffSection } from "./sections/StaffSection";
import { VisitFrequencySectionWrapper } from "./sections/VisitFrequencySectionWrapper";

export default function Page() {
  return (
    <AnalyticsShell>
      <KpiSection />
      <RevenueSectionWrapper />
      <RevenueByServiceSectionWrapper />
      <BookingsSectionWrapper />
      <StaffSection />
      <OperationalSection />
      <CheckoutRebookSectionWrapper />
      <RetentionSectionWrapper />
      <VisitFrequencySectionWrapper />
      <AppointmentGapSectionWrapper />
      <ClientsSection />
      <PromotionRoiSectionWrapper />
      <PeakTimesSectionWrapper />
    </AnalyticsShell>
  );
}
