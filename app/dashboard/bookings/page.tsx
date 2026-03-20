import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Bookings — T Creative Studio",
  description: "Manage all appointments and bookings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const [{ getClientBookings }, { ClientBookingsPage }] = await Promise.all([
      import("./client-actions"),
      import("./ClientBookingsPage"),
    ]);
    const data = await getClientBookings();
    return <ClientBookingsPage data={data} />;
  }

  if (user.profile?.role === "assistant") {
    const [{ getAssistantBookings }, { AssistantBookingsPage }] = await Promise.all([
      import("./actions"),
      import("./AssistantBookingsPage"),
    ]);
    const { bookings, stats } = await getAssistantBookings();
    return <AssistantBookingsPage initialBookings={bookings} stats={stats} />;
  }

  const [
    { getBookings },
    { getClientsForSelect, getServicesForSelect, getStaffForSelect },
    { getSubscriptions },
    { BookingsPage },
    { MembershipsSection },
  ] = await Promise.all([
    import("./actions"),
    import("./select-actions"),
    import("../subscriptions/actions"),
    import("./BookingsPage"),
    import("./sections/MembershipsSection"),
  ]);

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
      membershipsContent={<MembershipsSection />}
    />
  );
}
