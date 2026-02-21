import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Welcome | T Creative Studio",
  description: "Tell us a little about yourself so we can personalize your experience.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const role = params.role === "assistant" ? "assistant" : "client";

  return <OnboardingFlow role={role} />;
}
