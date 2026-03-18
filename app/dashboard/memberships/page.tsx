import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClientsForSelect } from "../bookings/select-actions";
import { getMembershipPlans, getMemberships } from "./actions";
import { MembershipsPage } from "./MembershipsPage";

export const metadata: Metadata = {
  title: "Memberships — T Creative Studio",
  description: "Manage Lash Club recurring membership subscriptions.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role === "client") redirect("/dashboard");

  const [memberships, plans, clients] = await Promise.all([
    getMemberships(),
    getMembershipPlans(true),
    getClientsForSelect(),
  ]);

  return <MembershipsPage initialMemberships={memberships} plans={plans} clients={clients} />;
}
