import type { Metadata } from "next";
import { ClientsPage } from "./ClientsPage";

export const metadata: Metadata = {
  title: "Clients — T Creative Studio",
  description: "Manage your client roster.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ClientsPage />;
}
