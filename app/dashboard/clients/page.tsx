import type { Metadata } from "next";
import { getClients, getClientLoyalty } from "./actions";
import { ClientsPage } from "./ClientsPage";

export const metadata: Metadata = {
  title: "Clients — T Creative Studio",
  description: "Manage your client roster.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialClients, initialLoyalty] = await Promise.all([getClients(), getClientLoyalty()]);

  return <ClientsPage initialClients={initialClients} initialLoyalty={initialLoyalty} />;
}
