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

  // Admin users see training under /dashboard/team (Training tab)
  redirect("/dashboard/team");
}
