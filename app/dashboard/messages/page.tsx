import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getThreads } from "./actions";
import { AssistantMessagesPage } from "./AssistantMessagesPage";
import { ClientMessagesPage } from "./ClientMessagesPage";
import { MessagesPage } from "./MessagesPage";

async function getClientList() {
  const rows = await db
    .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.role, "client"));
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Unknown",
  }));
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    return <ClientMessagesPage />;
  }

  if (user.profile?.role === "assistant") {
    const threads = await getThreads();
    return <AssistantMessagesPage initialThreads={threads} />;
  }

  const [threads, clients] = await Promise.all([getThreads(), getClientList()]);
  return <MessagesPage initialThreads={threads} clients={clients} />;
}
