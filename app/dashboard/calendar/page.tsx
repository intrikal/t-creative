import type { Metadata } from "next";
import {
  getBookings,
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "../bookings/actions";
import { CalendarPage } from "./CalendarPage";

export const metadata: Metadata = {
  title: "Calendar — T Creative Studio",
  description: "Visual calendar for appointments and scheduling.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialBookings, clients, serviceOptions, staffOptions] = await Promise.all([
    getBookings(),
    getClientsForSelect(),
    getServicesForSelect(),
    getStaffForSelect(),
  ]);

  return (
    <CalendarPage
      initialBookings={initialBookings}
      clients={clients}
      serviceOptions={serviceOptions}
      staffOptions={staffOptions}
    />
  );
}
