import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClientsForSelect, getServicesForSelect } from "../bookings/select-actions";
import { getSubscriptions } from "./actions";
import { SubscriptionsPage } from "./SubscriptionsPage";

export const metadata: Metadata = {
  title: "Subscriptions — T Creative Studio",
  description: "Manage pre-paid session packages for recurring clients.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role === "client") redirect("/dashboard");

  const [subscriptions, clients, allServices] = await Promise.all([
    getSubscriptions(),
    getClientsForSelect(),
    getServicesForSelect(),
  ]);

  const serviceOptions = allServices.map((s) => ({
    id: s.id,
    name: s.name,
    priceInCents: s.priceInCents,
  }));

  return (
    <SubscriptionsPage
      initialSubscriptions={subscriptions}
      clients={clients}
      serviceOptions={serviceOptions}
    />
  );
}
