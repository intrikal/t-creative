import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getPrograms,
  getStudents,
  getTrainingStats,
  getClients,
  getAssistantTraining,
} from "./actions";
import { AssistantTrainingPage } from "./AssistantTrainingPage";
import { getClientTraining } from "./client-actions";
import { ClientTrainingPage } from "./ClientTrainingPage";
import { TrainingPage } from "./TrainingPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const data = await getClientTraining();
    return <ClientTrainingPage data={data} />;
  }

  if (user.profile?.role === "assistant") {
    const data = await getAssistantTraining();
    return <AssistantTrainingPage data={data} />;
  }

  const [programs, students, stats, clients] = await Promise.all([
    getPrograms(),
    getStudents(),
    getTrainingStats(),
    getClients(),
  ]);

  return (
    <TrainingPage
      initialPrograms={programs}
      initialStudents={students}
      stats={stats}
      clients={clients}
    />
  );
}
