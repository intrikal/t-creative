import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Training — T Creative Studio",
  description: "Manage and track training programs and student progress.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const [{ getClientTraining }, { ClientTrainingPage }] = await Promise.all([
      import("./client-actions"),
      import("./ClientTrainingPage"),
    ]);
    const data = await getClientTraining();
    return <ClientTrainingPage data={data} />;
  }

  if (user.profile?.role === "assistant") {
    const [{ getAssistantTraining }, { AssistantTrainingPage }] = await Promise.all([
      import("./actions"),
      import("./AssistantTrainingPage"),
    ]);
    const data = await getAssistantTraining();
    return <AssistantTrainingPage data={data} />;
  }

  const [{ getPrograms, getStudents, getTrainingStats, getClients }, { TrainingPage }] =
    await Promise.all([import("./actions"), import("./TrainingPage")]);

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
