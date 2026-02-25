import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services, serviceAddOns } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ClientBookPage } from "./BookPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard");

  // Fetch active services + add-ons in parallel
  const [activeServices, allAddOns] = await Promise.all([
    db
      .select({
        id: services.id,
        category: services.category,
        name: services.name,
        priceInCents: services.priceInCents,
        depositInCents: services.depositInCents,
        durationMinutes: services.durationMinutes,
        description: services.description,
      })
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(services.sortOrder),
    db
      .select({
        id: serviceAddOns.id,
        serviceId: serviceAddOns.serviceId,
        name: serviceAddOns.name,
        description: serviceAddOns.description,
        priceInCents: serviceAddOns.priceInCents,
        additionalMinutes: serviceAddOns.additionalMinutes,
      })
      .from(serviceAddOns)
      .where(eq(serviceAddOns.isActive, true)),
  ]);

  // Group add-ons by service ID for O(1) lookup
  const addOnsByService: Record<number, typeof allAddOns> = {};
  for (const addon of allAddOns) {
    (addOnsByService[addon.serviceId] ??= []).push(addon);
  }

  return <ClientBookPage services={activeServices} addOnsByService={addOnsByService} />;
}
