import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientTraining } from "./actions";
import { ClientTrainingPage } from "./TrainingPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getClientTraining();
  return <ClientTrainingPage data={data} />;
}
