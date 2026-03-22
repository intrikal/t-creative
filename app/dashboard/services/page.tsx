import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Services — T Creative Studio",
  description: "Manage your service menu, bundles, and client forms.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "client") redirect("/dashboard");

  if (user.profile?.role === "assistant") {
    const [{ getAssistantServices }, { AssistantServicesPage }] = await Promise.all([
      import("./actions"),
      import("./AssistantServicesPage"),
    ]);
    const { services: svcList, stats } = await getAssistantServices();
    return <AssistantServicesPage initialServices={svcList} stats={stats} />;
  }

  await requireAdmin();
  const [
    { getServices },
    { getBundles },
    { getForms },
    { getIntakeFormDefinitions },
    { ServicesPage },
    { getAftercareSections, getPolicies, seedAftercareDefaults },
    { AftercarePage },
    { PortfolioSection },
  ] = await Promise.all([
    import("./actions"),
    import("./bundle-actions"),
    import("./form-actions"),
    import("./intake-form-actions"),
    import("./ServicesPage"),
    import("../aftercare/actions"),
    import("../aftercare/AftercarePage"),
    import("./sections/PortfolioSection"),
  ]);

  await seedAftercareDefaults();

  const [initialServices, initialBundles, initialForms, initialIntakeForms, aftercareSections, aftercarePolicies] =
    await Promise.all([
      getServices(),
      getBundles(),
      getForms(),
      getIntakeFormDefinitions(),
      getAftercareSections(),
      getPolicies(),
    ]);

  return (
    <ServicesPage
      initialServices={initialServices}
      initialBundles={initialBundles}
      initialForms={initialForms}
      initialIntakeForms={initialIntakeForms}
      aftercareContent={
        <AftercarePage initialSections={aftercareSections} initialPolicies={aftercarePolicies} />
      }
      portfolioContent={<PortfolioSection />}
    />
  );
}
