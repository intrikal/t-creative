/**
 * Cached setup / onboarding data for clients — used by the sidebar
 * progress counter and the get-started page.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export type ClientSetupData = {
  firstName: string;
  hasProfile: boolean;
  hasPreferences: boolean;
  hasPolicies: boolean;
  /** "0/3" … "3/3" */
  setupProgress: string;
};

export const getClientSetupData = cache(async (userId: string): Promise<ClientSetupData> => {
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)
    .then((r) => r[0]);

  const data = (profile?.onboardingData ?? {}) as Record<string, unknown>;

  // Step 1: Profile complete — has name and at least one interest selected
  const interests = data.interests as string[] | null;
  const hasProfile = !!(profile?.firstName && interests && interests.length > 0);

  // Step 2: Preferences set — allergies and availability filled in
  const allergies = data.allergies as Record<string, unknown> | null;
  const availability = data.availability as Record<string, unknown> | null;
  const hasPreferences = !!(allergies && availability);

  // Step 3: Policies agreed — waiver + cancellation
  const hasPolicies = !!(data.waiverAgreed && data.cancellationAgreed);

  let done = 0;
  if (hasProfile) done++;
  if (hasPreferences) done++;
  if (hasPolicies) done++;

  return {
    firstName: profile?.firstName ?? "",
    hasProfile,
    hasPreferences,
    hasPolicies,
    setupProgress: `${done}/3`,
  };
});
