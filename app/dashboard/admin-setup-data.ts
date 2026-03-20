/**
 * Cached setup / onboarding data used by both the dashboard layout (sidebar
 * progress counter) and the get-started page.  Wrapped with React `cache()`
 * so repeated calls within the same server render share a single DB round-trip.
 */
import { cache } from "react";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { services as servicesTable } from "@/db/schema/services";

export type AdminSetupData = {
  firstName: string;
  studioName: string | null;
  locationArea: string | null;
  socialCount: number;
  hasPolicies: boolean;
  hasDeposits: boolean;
  /** "0/3" … "3/3" */
  setupProgress: string;
};

export const getAdminSetupData = cache(async (userId: string): Promise<AdminSetupData> => {
  const [profile, servicesWithDeposit] = await Promise.all([
    db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(isNotNull(servicesTable.depositInCents))
      .limit(1),
  ]);

  const data = (profile?.onboardingData ?? {}) as Record<string, unknown>;
  const studioName = (data.studioName as string | null) ?? null;
  const location = (data.location as { type?: string; area?: string } | null) ?? null;
  const socials = (data.socials as Record<string, string> | null) ?? null;
  const policies = (data.policies as {
    cancellationFeeInCents?: number | null;
    noShowFeeInCents?: number | null;
  } | null) ?? null;

  const locationArea = location?.area ?? null;
  const socialCount = socials ? Object.keys(socials).length : 0;
  const hasPolicies = !!(policies?.cancellationFeeInCents || policies?.noShowFeeInCents);
  const hasDeposits = servicesWithDeposit.length > 0;

  let done = 0;
  if (studioName && locationArea && socialCount > 0) done++;
  if (hasPolicies) done++;
  if (hasDeposits) done++;

  return {
    firstName: profile?.firstName ?? "",
    studioName,
    locationArea,
    socialCount,
    hasPolicies,
    hasDeposits,
    setupProgress: `${done}/3`,
  };
});
