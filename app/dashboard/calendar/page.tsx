import type { Metadata } from "next";
import {
  getBookings,
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "../bookings/actions";
import { getEvents } from "../events/actions";
import { getBusinessHours, getTimeOff, getLunchBreak } from "../settings/hours-actions";
import { CalendarPage } from "./CalendarPage";

export const metadata: Metadata = {
  title: "Calendar — T Creative Studio",
  description: "Visual calendar for appointments and scheduling.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [
    initialBookings,
    clients,
    serviceOptions,
    staffOptions,
    businessHours,
    timeOffRows,
    lunchBreak,
    eventRows,
  ] = await Promise.all([
    getBookings(),
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
      initialBookings={initialBookings}
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
