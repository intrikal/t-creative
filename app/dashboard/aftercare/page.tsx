import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Aftercare & Policies — T Creative Studio",
  description: "Manage aftercare instructions and studio policies.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const [{ getClientAftercare }, { ClientAftercarePage }] = await Promise.all([
      import("./client-actions"),
      import("./ClientAftercarePage"),
    ]);
    const sections = await getClientAftercare();
    return <ClientAftercarePage sections={sections} />;
  }

  const [{ getAftercareSections, getPolicies, seedAftercareDefaults }] = await Promise.all([
    import("./actions"),
  ]);

  // Seed defaults on first visit if the table is empty
  await seedAftercareDefaults();

  const [sections, policyList] = await Promise.all([getAftercareSections(), getPolicies()]);

  if (user.profile?.role === "assistant") {
    const { AssistantAftercarePage } = await import("./AssistantAftercarePage");
    return <AssistantAftercarePage initialSections={sections} initialPolicies={policyList} />;
  }

  const { AftercarePage } = await import("./AftercarePage");
  return <AftercarePage initialSections={sections} initialPolicies={policyList} />;
}
