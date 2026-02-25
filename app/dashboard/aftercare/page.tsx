import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAftercareSections, getPolicies, seedAftercareDefaults } from "./actions";
import { AftercarePage } from "./AftercarePage";
import { AssistantAftercarePage } from "./AssistantAftercarePage";
import { getClientAftercare } from "./client-actions";
import { ClientAftercarePage } from "./ClientAftercarePage";

export const metadata: Metadata = {
  title: "Aftercare & Policies — T Creative Studio",
  description: "Manage aftercare instructions and studio policies.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "client") {
    const sections = await getClientAftercare();
    return <ClientAftercarePage sections={sections} />;
  }

  // Seed defaults on first visit if the table is empty
  await seedAftercareDefaults();

  const [sections, policyList] = await Promise.all([getAftercareSections(), getPolicies()]);

  if (user.profile?.role === "assistant") {
    return <AssistantAftercarePage initialSections={sections} initialPolicies={policyList} />;
  }

  return <AftercarePage initialSections={sections} initialPolicies={policyList} />;
}
