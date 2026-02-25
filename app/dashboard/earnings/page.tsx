import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAssistantEarnings } from "./actions";
import { AssistantEarningsPage } from "./EarningsPage";

export const metadata: Metadata = {
  title: "Earnings — T Creative Studio",
  description: "Track your earnings and commission breakdown.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getAssistantEarnings();
  return <AssistantEarningsPage data={data} />;
}
