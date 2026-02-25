import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getServices, getAssistantServices } from "./actions";
import { AssistantServicesPage } from "./AssistantServicesPage";
import { getBundles } from "./bundle-actions";
import { getForms } from "./form-actions";
import { ServicesPage } from "./ServicesPage";

export const metadata: Metadata = {
  title: "Services — T Creative Studio",
  description: "Manage your service menu, bundles, and client forms.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "assistant") {
    const { services: svcList, stats } = await getAssistantServices();
    return <AssistantServicesPage initialServices={svcList} stats={stats} />;
  }

  const [initialServices, initialBundles, initialForms] = await Promise.all([
    getServices(),
    getBundles(),
    getForms(),
  ]);

  return (
    <ServicesPage
      initialServices={initialServices}
      initialBundles={initialBundles}
      initialForms={initialForms}
    />
  );
}
