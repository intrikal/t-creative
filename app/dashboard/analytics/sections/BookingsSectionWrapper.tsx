import { Suspense } from "react";
import { getBookingsTrend, getServiceMix } from "../actions";
import { BookingsSection } from "../components/BookingsSection";

function BookingsSkeleton() {
  return <div className="h-72 bg-surface rounded-xl animate-pulse" />;
}

async function BookingsData() {
  const [bookingsTrend, serviceMix] = await Promise.all([getBookingsTrend(), getServiceMix()]);
  return <BookingsSection bookingsTrend={bookingsTrend} serviceMix={serviceMix} />;
}

export function BookingsSectionWrapper() {
  return (
    <Suspense fallback={<BookingsSkeleton />}>
      <BookingsData />
    </Suspense>
  );
}
