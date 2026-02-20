/**
 * page.tsx — Onboarding page route
 *
 * What: The entry point for the "/onboarding" URL in the application.
 * Why: In Next.js, each folder inside `app/` that contains a `page.tsx` file
 *      becomes a navigable URL. This file defines what users see at /onboarding.
 * How: It renders the <OnboardingFlow /> component, which handles the entire
 *      multi-step onboarding wizard. The `metadata` export sets the browser tab
 *      title and description for SEO — Next.js reads this automatically.
 *
 * Key concepts:
 * - "Server component" (default): This file runs on the server, not in the
 *   browser. It can export `metadata` because server components support that.
 * - The actual interactive logic lives in OnboardingFlow (a "client component"),
 *   keeping this page file thin and focused on routing.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — the wizard this page renders
 * - lib/onboarding-schema.ts — validation rules for all collected data
 */
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Welcome | T Creative Studio",
  description: "Tell us a little about yourself so we can personalize your experience.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
