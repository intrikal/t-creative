import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getScheduleData } from "./actions";
import { AssistantSchedulePage } from "./SchedulePage";

export const metadata: Metadata = {
  title: "Schedule — T Creative Studio",
  description: "View and manage your appointment schedule.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "client") redirect("/dashboard");

  if (user.profile?.role === "assistant") {
    const [{ getAssistantBookings }, { getAssistantEvents }] = await Promise.all([
      import("../bookings/actions"),
      import("../events/assistant-actions"),
    ]);

    const [scheduleData, bookingsData, eventsData] = await Promise.all([
      getScheduleData(),
      getAssistantBookings(),
      getAssistantEvents(),
    ]);

    return (
      <AssistantSchedulePage
        initialAppointments={scheduleData.appointments}
        stats={scheduleData.stats}
        todayKey={scheduleData.todayKey}
        bookings={bookingsData.bookings}
        bookingStats={bookingsData.stats}
        events={eventsData.events}
        eventStats={eventsData.stats}
      />
    );
  }

  const { appointments, stats, todayKey } = await getScheduleData();
  return (
    <AssistantSchedulePage initialAppointments={appointments} stats={stats} todayKey={todayKey} />
  );
}
