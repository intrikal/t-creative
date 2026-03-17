import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSubscriptions } from "../subscriptions/actions";
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

  const [bookingsResult, clients, serviceOptions, staffOptions, allSubscriptions] =
    await Promise.all([
      getBookings(),
      getClientsForSelect(),
      getServicesForSelect(),
      getStaffForSelect(),
      getSubscriptions("active"),
    ]);

  const activeSubscriptions = allSubscriptions.map((s) => ({
    id: s.id,
    clientId: s.clientId,
    name: s.name,
    sessionsRemaining: s.sessionsRemaining,
  }));

  return (
    <BookingsPage
      initialBookings={bookingsResult.rows}
      initialHasMore={bookingsResult.hasMore}
      clients={clients}
      serviceOptions={serviceOptions}
      staffOptions={staffOptions}
      activeSubscriptions={activeSubscriptions}
    />
  );
}
