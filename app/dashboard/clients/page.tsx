import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Clients — T Creative Studio",
  description: "Manage your client roster.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "client") redirect("/dashboard");

  if (user.profile?.role === "assistant") {
    const [{ getAssistantClients }, { AssistantClientsPage }] = await Promise.all([
      import("./actions"),
      import("./AssistantClientsPage"),
    ]);
    const { clients, stats } = await getAssistantClients();
    return <AssistantClientsPage initialClients={clients} stats={stats} />;
  }

  const [{ getClients }, { getLoyaltyRewards }, { ClientsPage }] = await Promise.all([
    import("./actions"),
    import("./loyalty-rewards-actions"),
    import("./ClientsPage"),
  ]);

  const [clientsResult, initialRewards] = await Promise.all([getClients(), getLoyaltyRewards()]);

  return (
    <ClientsPage
      initialClients={clientsResult.rows}
      initialHasMore={clientsResult.hasMore}
      initialLoyalty={[]}
      initialRewards={initialRewards}
    />
  );
}
