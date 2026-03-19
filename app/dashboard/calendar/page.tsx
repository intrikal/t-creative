import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getBookings } from "../bookings/actions";
import {
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "../bookings/select-actions";
import { getEvents } from "../events/actions";
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

  const [
    bookingsResult,
    clients,
    serviceOptions,
    staffOptions,
    businessHours,
    timeOffRows,
    lunchBreak,
    eventRows,
  ] = await Promise.all([
    getBookings({ limit: 500 }),
    getClientsForSelect(),
    getServicesForSelect(),
    getStaffForSelect(),
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getEvents(),
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
    />
  );
}
