import { getScheduleData } from "./actions";
import { AssistantSchedulePage } from "./SchedulePage";

export default async function Page() {
  const { appointments, stats, todayKey } = await getScheduleData();

  return (
    <AssistantSchedulePage initialAppointments={appointments} stats={stats} todayKey={todayKey} />
  );
}
