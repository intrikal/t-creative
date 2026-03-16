import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getLegalDoc, seedLegalDefaults } from "./actions";
import { LegalDocumentsPage } from "./LegalDocumentsPage";

export const metadata: Metadata = {
  title: "Legal Documents — T Creative Studio",
  description: "Manage Privacy Policy and Terms of Service.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

  await seedLegalDefaults();

  const [privacyDoc, termsDoc] = await Promise.all([
    getLegalDoc("privacy_policy"),
    getLegalDoc("terms_of_service"),
  ]);

  return <LegalDocumentsPage initialPrivacy={privacyDoc} initialTerms={termsDoc} />;
}
