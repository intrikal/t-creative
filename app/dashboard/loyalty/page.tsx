import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getClientLoyaltyData } from "./actions";
import { LoyaltyPage } from "./LoyaltyPage";

export const metadata: Metadata = {
  title: "Loyalty & Rewards — T Creative Studio",
  description: "Your loyalty tier, referral code, and points history.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard");

  const data = await getClientLoyaltyData();
  return <LoyaltyPage data={data} />;
}
