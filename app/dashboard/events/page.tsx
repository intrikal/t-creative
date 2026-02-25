import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEvents, getClientEvents } from "./actions";
import { ClientEventsPage } from "./ClientEventsPage";
import { EventsPage } from "./EventsPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const events = await getClientEvents();
    return <ClientEventsPage events={events} />;
  }

  // Admin and assistant both see the full events management view
  const events = await getEvents();
  return <EventsPage initialEvents={events} />;
}
