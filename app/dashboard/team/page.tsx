import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { AssistantsPage } from "../assistants/AssistantsPage";

export const metadata: Metadata = {
  title: "Team — T Creative Studio",
  description: "Manage your team roster, availability, and shifts.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  return <AssistantsPage pageTitle="Team" pageSubtitle="Your team overview and performance" />;
}
