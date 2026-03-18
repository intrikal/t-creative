import type { Metadata } from "next";
import { getScheduleData } from "./actions";
import { AssistantSchedulePage } from "./SchedulePage";

export const metadata: Metadata = {
  title: "Schedule — T Creative Studio",
  description: "View and manage your appointment schedule.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { appointments, stats, todayKey } = await getScheduleData();

  return (
    <AssistantSchedulePage initialAppointments={appointments} stats={stats} todayKey={todayKey} />
  );
}
