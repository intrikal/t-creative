/**
 * AdminPage — the /admin home page (Server Component).
 *
 * ## Responsibility
 * Fetches the admin's profile and service data, then passes the derived props
 * to the `AdminDashboard` client component.
 *
 * ## Data fetching strategy
 * Two queries run in parallel via `Promise.all` to minimize latency:
 * 1. Full profile row — to extract name, studioName, location, socials, and policies
 *    from the `onboarding_data` JSONB column.
 * 2. Services with a non-null `depositInCents` — a lightweight existence check
 *    (`LIMIT 1`) to determine if any deposits have been configured.
 *
 * ## JSONB extraction
 * The `onboarding_data` column is a free-form JSON object (type `Record<string, unknown>`).
 * Fields are cast inline (e.g. `as string | null`) because Drizzle returns JSONB
 * columns as `unknown`. This keeps the type-narrowing co-located with usage rather
 * than requiring a separate Zod parse on the read path.
 *
 * ## Props passed to AdminDashboard
 * - `firstName` — personalized greeting
 * - `studioName` — used to derive the booking URL slug
 * - `locationArea` — shown in the setup checklist
 * - `socialCount` — number of connected social accounts
 * - `hasPolicies` — true if at least one protection fee is set
 * - `hasDeposits` — true if any service has a deposit amount configured
 */
import { eq, isNotNull } from "drizzle-orm";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { services as servicesTable } from "@/db/schema/services";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getCurrentUser();

  const [profile, servicesWithDeposit] = await Promise.all([
    db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user!.id))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(isNotNull(servicesTable.depositInCents))
      .limit(1),
  ]);

  const onboardingData = (profile?.onboardingData ?? {}) as Record<string, unknown>;
  const studioName = (onboardingData.studioName as string | null) ?? null;
  const location = (onboardingData.location as { type?: string; area?: string } | null) ?? null;
  const socials = (onboardingData.socials as Record<string, string> | null) ?? null;
  const policies =
    (onboardingData.policies as {
      cancellationFeeInCents?: number | null;
      noShowFeeInCents?: number | null;
    } | null) ?? null;

  const socialCount = socials ? Object.keys(socials).length : 0;

  return (
    <AdminDashboard
      firstName={profile?.firstName ?? ""}
      studioName={studioName}
      locationArea={location?.area ?? null}
      socialCount={socialCount}
      hasPolicies={!!(policies?.cancellationFeeInCents || policies?.noShowFeeInCents)}
      hasDeposits={servicesWithDeposit.length > 0}
    />
  );
}
