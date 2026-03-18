import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getEvents, getClientEvents, getVenues, getStaffForEvents } from "./actions";
import { ClientEventsPage } from "./ClientEventsPage";
import { EventsPage } from "./EventsPage";

export const metadata: Metadata = {
  title: "Events — T Creative Studio",
  description: "Manage studio events and client event registrations.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const events = await getClientEvents();
    return <ClientEventsPage events={events} />;
  }

  // Admin and assistant both see the full events management view
  const [events, venues, staffList] = await Promise.all([
    getEvents(),
    getVenues(),
    getStaffForEvents(),
  ]);
  return <EventsPage initialEvents={events} initialVenues={venues} staffList={staffList} />;
}
