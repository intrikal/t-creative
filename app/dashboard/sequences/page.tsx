import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSequences } from "./actions";
import { SequencesPage } from "./SequencesPage";

export const metadata: Metadata = {
  title: "Email Sequences — T Creative Studio",
  description: "Manage automated email drip campaigns.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  const sequences = await getSequences();
  return <SequencesPage initialData={sequences} />;
}
