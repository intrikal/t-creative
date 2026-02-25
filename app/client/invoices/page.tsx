import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientInvoices } from "./actions";
import { ClientInvoicesPage } from "./InvoicesPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getClientInvoices();
  return <ClientInvoicesPage data={data} />;
}
