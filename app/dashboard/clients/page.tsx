import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClients, getClientLoyalty, getAssistantClients } from "./actions";
import { AssistantClientsPage } from "./AssistantClientsPage";
import { ClientsPage } from "./ClientsPage";

export const metadata: Metadata = {
  title: "Clients — T Creative Studio",
  description: "Manage your client roster.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    const { clients, stats } = await getAssistantClients();
    return <AssistantClientsPage initialClients={clients} stats={stats} />;
  }

  const [initialClients, initialLoyalty] = await Promise.all([getClients(), getClientLoyalty()]);

  return <ClientsPage initialClients={initialClients} initialLoyalty={initialLoyalty} />;
}
