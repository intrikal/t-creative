import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AssistantMessagesPage } from "./AssistantMessagesPage";
import { MessagesPage } from "./MessagesPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    return <AssistantMessagesPage />;
  }

  return <MessagesPage />;
}
