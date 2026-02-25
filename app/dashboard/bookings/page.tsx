import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import {
  getBookings,
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
} from "./actions";
import { AssistantBookingsPage } from "./AssistantBookingsPage";
import { BookingsPage } from "./BookingsPage";

export const metadata: Metadata = {
  title: "Bookings — T Creative Studio",
  description: "Manage all appointments and bookings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    return <AssistantBookingsPage />;
  }

  const [initialBookings, clients, serviceOptions, staffOptions] = await Promise.all([
    getBookings(),
    getClientsForSelect(),
    getServicesForSelect(),
    getStaffForSelect(),
  ]);

  return (
    <BookingsPage
      initialBookings={initialBookings}
      clients={clients}
      serviceOptions={serviceOptions}
      staffOptions={staffOptions}
    />
  );
}
