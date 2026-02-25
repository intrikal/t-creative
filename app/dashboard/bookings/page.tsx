import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import {
  getBookings,
  getClientsForSelect,
  getServicesForSelect,
  getStaffForSelect,
  getAssistantBookings,
} from "./actions";
import { AssistantBookingsPage } from "./AssistantBookingsPage";
import { BookingsPage } from "./BookingsPage";
import { getClientBookings } from "./client-actions";
import { ClientBookingsPage } from "./ClientBookingsPage";

export const metadata: Metadata = {
  title: "Bookings — T Creative Studio",
  description: "Manage all appointments and bookings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const data = await getClientBookings();
    return <ClientBookingsPage data={data} />;
  }

  if (user.profile?.role === "assistant") {
    const { bookings, stats } = await getAssistantBookings();
    return <AssistantBookingsPage initialBookings={bookings} stats={stats} />;
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
