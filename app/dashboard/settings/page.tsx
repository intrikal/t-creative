/**
 * Server component for `/dashboard/settings`.
 *
 * Fetches 7 datasets in parallel via `Promise.all`:
 * - Business hours, time-off blocks, lunch break (from `hours-actions`)
 * - Business profile, policies, loyalty config, notifications (from `settings-actions`)
 *
 * All data is passed as serialised props to the client-side `SettingsPage` shell,
 * which delegates to individual tab components.
 *
 * @module settings/page
 * @see {@link ./hours-actions.ts} — schedule-related server actions
 * @see {@link ./settings-actions.ts} — key-value settings server actions
 * @see {@link ./SettingsPage.tsx} — client component (tab shell)
 */
import type { Metadata } from "next";
import { getBusinessHours, getTimeOff, getLunchBreak } from "./hours-actions";
import {
  getBusinessProfile,
  getPolicies,
  getLoyaltyConfig,
  getNotificationPrefs,
} from "./settings-actions";
import { SettingsPage } from "./SettingsPage";

export const metadata: Metadata = {
  title: "Settings — T Creative Studio",
  description: "Business settings and configuration.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [
    initialHours,
    initialTimeOff,
    initialLunchBreak,
    initialBusiness,
    initialPolicies,
    initialLoyalty,
    initialNotifications,
  ] = await Promise.all([
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
    getBusinessProfile(),
    getPolicies(),
    getLoyaltyConfig(),
    getNotificationPrefs(),
  ]);

  return (
    <SettingsPage
      initialHours={initialHours}
      initialTimeOff={initialTimeOff}
      initialLunchBreak={initialLunchBreak}
      initialBusiness={initialBusiness}
      initialPolicies={initialPolicies}
      initialLoyalty={initialLoyalty}
      initialNotifications={initialNotifications}
    />
  );
}
