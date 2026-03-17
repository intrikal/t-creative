import { Suspense } from "react";
import { getBookingsTrend, getServiceMix, type Range } from "../actions";
import { BookingsSection } from "../components/BookingsSection";

function BookingsSkeleton() {
  return <div className="h-72 bg-surface rounded-xl animate-pulse" />;
}

async function BookingsData({ range }: { range: Range }) {
  const [bookingsTrend, serviceMix] = await Promise.all([
    getBookingsTrend(range),
    getServiceMix(range),
  ]);
  return <BookingsSection bookingsTrend={bookingsTrend} serviceMix={serviceMix} />;
}

export function BookingsSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<BookingsSkeleton />}>
      <BookingsData range={range} />
    </Suspense>
  );
}
