import { AnalyticsShell } from "./AnalyticsShell";
import { AppointmentGapSectionWrapper } from "./sections/AppointmentGapSectionWrapper";
import { BookingsSectionWrapper } from "./sections/BookingsSectionWrapper";
import { ClientsSection } from "./sections/ClientsSection";
import { KpiSection } from "./sections/KpiSection";
import { OperationalSection } from "./sections/OperationalSection";
import { PeakTimesSectionWrapper } from "./sections/PeakTimesSectionWrapper";
import { RetentionSectionWrapper } from "./sections/RetentionSectionWrapper";
import { RevenueSectionWrapper } from "./sections/RevenueSectionWrapper";
import { StaffSection } from "./sections/StaffSection";

export default function Page() {
  return (
    <AnalyticsShell>
      <KpiSection />
      <RevenueSectionWrapper />
      <BookingsSectionWrapper />
      <StaffSection />
      <OperationalSection />
      <RetentionSectionWrapper />
      <AppointmentGapSectionWrapper />
      <ClientsSection />
      <PeakTimesSectionWrapper />
    </AnalyticsShell>
  );
}
