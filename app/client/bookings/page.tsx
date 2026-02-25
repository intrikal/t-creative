import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientBookings } from "./actions";
import { ClientBookingsPage } from "./BookingsPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getClientBookings();
  return <ClientBookingsPage data={data} />;
}
