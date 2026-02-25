import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrograms, getStudents, getTrainingStats, getClients } from "./actions";
import { AssistantTrainingPage } from "./AssistantTrainingPage";
import { TrainingPage } from "./TrainingPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    return <AssistantTrainingPage />;
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
