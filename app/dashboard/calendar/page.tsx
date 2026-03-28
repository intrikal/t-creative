import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getBookings } from "../bookings/actions";
import {
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "../bookings/select-actions";
import { getEvents, getVenues } from "../events/actions";
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

  // Batch 1: heavy queries (bookings, events) + lightweight reference data.
  // getBookings and getEvents each do follow-up queries internally, so we
  // keep the total concurrent connection count well within the pool size.
  const [bookingsResult, eventRows, staffOptions, clients] = await Promise.all([
    getBookings({ limit: 500, startDate, endDate }),
    getEvents({ startDate, endDate }),
    getStaffForSelect(),
    getClientsForSelect(),
  ]);

  // Batch 2: remaining lightweight lookups (5 simple single-table queries).
  const [serviceOptions, businessHours, timeOffRows, lunchBreak, venues] = await Promise.all([
    getServicesForSelect(),
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getVenues(),
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
      eventStaff={staffOptions}
    />
  );
}
