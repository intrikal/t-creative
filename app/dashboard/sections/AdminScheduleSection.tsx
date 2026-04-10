import Link from "next/link";
import { CalendarX, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminTodayBookings } from "../admin-home-queries";
import { EmptyState } from "../components/AdminEmptyState";
import { BookingRow } from "../components/AdminListRows";

export async function AdminScheduleSection({ locationId }: { locationId?: number }) {
  const { todayBookings } = await getAdminTodayBookings(locationId);

  return (
    <Card className="xl:col-span-3 gap-0 py-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Today&apos;s Schedule</CardTitle>
          <Link
            href="/dashboard/bookings"
            className="text-xs text-accent hover:underline flex items-center gap-0.5"
          >
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-2">
        {todayBookings.length > 0 ? (
          todayBookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)
        ) : (
          <EmptyState
            icon={CalendarX}
            message="No appointments today"
            detail="New bookings will appear here once confirmed."
            actionLabel="New Booking"
            actionHref="/dashboard/bookings"
          />
        )}
      </CardContent>
    </Card>
  );
}
