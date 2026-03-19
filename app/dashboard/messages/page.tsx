import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages — T Creative Studio",
  description: "View and manage client messages and conversations.",
  robots: { index: false, follow: false },
};

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
    const { ClientMessagesPage } = await import("./ClientMessagesPage");
    return <ClientMessagesPage />;
  }

  if (user.profile?.role === "assistant") {
    const [{ getThreads }, { AssistantMessagesPage }] = await Promise.all([
      import("./actions"),
      import("./AssistantMessagesPage"),
    ]);
    const threads = await getThreads();
    return <AssistantMessagesPage initialThreads={threads} />;
  }

  const [{ getThreads }, { MessagesPage }] = await Promise.all([
    import("./actions"),
    import("./MessagesPage"),
  ]);
  const [threads, clients] = await Promise.all([getThreads(), getClientList()]);
  return <MessagesPage initialThreads={threads} clients={clients} />;
}
