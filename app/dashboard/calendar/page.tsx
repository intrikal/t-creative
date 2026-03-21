import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getBookings } from "../bookings/actions";
import {
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "../bookings/select-actions";
import { getEvents, getVenues, getStaffForEvents } from "../events/actions";
import { getBusinessHours, getTimeOff, getLunchBreak } from "../settings/hours-actions";
import { CalendarPage } from "./CalendarPage";

export const metadata: Metadata = {
  title: "Calendar — T Creative Studio",
  description: "Visual calendar for appointments and scheduling.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startDate.setDate(startDate.getDate() - 60);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  endDate.setDate(endDate.getDate() + 60);

  const [
    bookingsResult,
    clients,
    serviceOptions,
    staffOptions,
    businessHours,
    timeOffRows,
    lunchBreak,
    eventRows,
    venues,
    eventStaff,
  ] = await Promise.all([
    getBookings({ limit: 500, startDate, endDate }),
    getClientsForSelect(),
    getServicesForSelect(),
    getStaffForSelect(),
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getEvents({ startDate, endDate }),
    getVenues(),
    getStaffForEvents(),
  ]);

  return (
    <CalendarPage
      initialBookings={bookingsResult.rows}
      clients={clients}
      serviceOptions={serviceOptions}
      staffOptions={staffOptions}
      businessHours={businessHours}
      timeOff={timeOffRows}
      lunchBreak={lunchBreak}
      events={eventRows}
      venues={venues}
      eventStaff={eventStaff}
    />
  );
}
