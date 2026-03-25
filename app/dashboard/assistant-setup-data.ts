/**
 * Cached setup / onboarding data for assistants — used by the sidebar
 * progress counter and the get-started page.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, assistantProfiles } from "@/db/schema";

export type AssistantSetupData = {
  firstName: string;
  hasProfile: boolean;
  hasAvailability: boolean;
  hasEmergencyAndPolicies: boolean;
  /** "0/3" … "3/3" */
  setupProgress: string;
};

export const getAssistantSetupData = cache(async (userId: string): Promise<AssistantSetupData> => {
  const [profile, assistantProfile] = await Promise.all([
    db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, userId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const data = (profile?.onboardingData ?? {}) as Record<string, unknown>;

  // Step 1: Profile complete — has assistant_profiles row with specialties
  const hasProfile = !!assistantProfile?.specialties;

  // Step 2: Availability set — has at least one available date
  const availability = data.availability as {
    dates?: string[];
    defaultStart?: string;
    defaultEnd?: string;
  } | null;
  const hasAvailability = !!(
    availability?.dates &&
    Array.isArray(availability.dates) &&
    availability.dates.length > 0
  );

  // Step 3: Emergency contact + all 4 policies acknowledged
  const policies = data.policies as {
    clientPhotos?: boolean;
    confidentiality?: boolean;
    conduct?: boolean;
    compensation?: boolean;
  } | null;
  const hasEmergency = !!(data.emergencyContactName && data.emergencyContactPhone);
  const hasPolicies = !!(
    policies?.clientPhotos &&
    policies?.confidentiality &&
    policies?.conduct &&
    policies?.compensation
  );
  const hasEmergencyAndPolicies = hasEmergency && hasPolicies;

  let done = 0;
  if (hasProfile) done++;
  if (hasAvailability) done++;
  if (hasEmergencyAndPolicies) done++;

  return {
    firstName: profile?.firstName ?? "",
    hasProfile,
    hasAvailability,
    hasEmergencyAndPolicies,
    setupProgress: `${done}/3`,
  };
});
