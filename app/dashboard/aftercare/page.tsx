import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AftercarePage } from "./AftercarePage";
import { AssistantAftercarePage } from "./AssistantAftercarePage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    return <AssistantAftercarePage />;
  }

  return <AftercarePage />;
}
