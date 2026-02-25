import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAftercareSections, getPolicies, seedAftercareDefaults } from "./actions";
import { AftercarePage } from "./AftercarePage";
import { AssistantAftercarePage } from "./AssistantAftercarePage";

export const metadata: Metadata = {
  title: "Aftercare & Policies — T Creative Studio",
  description: "Manage aftercare instructions and studio policies.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Seed defaults on first visit if the table is empty
  await seedAftercareDefaults();

  const [sections, policyList] = await Promise.all([getAftercareSections(), getPolicies()]);

  if (user.profile?.role === "assistant") {
    return <AssistantAftercarePage initialSections={sections} initialPolicies={policyList} />;
  }

  return <AftercarePage initialSections={sections} initialPolicies={policyList} />;
}
