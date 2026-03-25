import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSetupData } from "../admin-setup-data";
import { getAssistantSetupData } from "../assistant-setup-data";
import { getClientSetupData } from "../client-setup-data";
import { AssistantGetStartedPage } from "./AssistantGetStartedPage";
import { ClientGetStartedPage } from "./ClientGetStartedPage";
import { GettingStartedPage } from "./GettingStartedPage";

export const metadata: Metadata = {
  title: "Getting Started — T Creative Studio",
  description: "Set up your studio and start accepting bookings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.profile?.role;

  if (role === "client") {
    const data = await getClientSetupData(user.id);
    return (
      <ClientGetStartedPage
        firstName={data.firstName}
        hasProfile={data.hasProfile}
        hasPreferences={data.hasPreferences}
        hasPolicies={data.hasPolicies}
      />
    );
  }

  if (role === "assistant") {
    const data = await getAssistantSetupData(user.id);
    return (
      <AssistantGetStartedPage
        firstName={data.firstName}
        hasProfile={data.hasProfile}
        hasAvailability={data.hasAvailability}
        hasEmergencyAndPolicies={data.hasEmergencyAndPolicies}
      />
    );
  }

  const data = await getAdminSetupData(user.id);
  return (
    <GettingStartedPage
      firstName={data.firstName}
      studioName={data.studioName}
      locationArea={data.locationArea}
      socialCount={data.socialCount}
      hasPolicies={data.hasPolicies}
      hasDeposits={data.hasDeposits}
    />
  );
}
