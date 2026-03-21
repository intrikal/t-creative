import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSetupData } from "../admin-setup-data";
import { GettingStartedPage } from "./GettingStartedPage";

export const metadata: Metadata = {
  title: "Getting Started — T Creative Studio",
  description: "Set up your studio and start accepting bookings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

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
