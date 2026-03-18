import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClientInvoices } from "./actions";
import { ClientInvoicesPage } from "./InvoicesPage";

export const metadata: Metadata = {
  title: "Invoices — T Creative Studio",
  description: "View and manage your studio invoices.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard/financial");

  const data = await getClientInvoices();
  return <ClientInvoicesPage data={data} />;
}
