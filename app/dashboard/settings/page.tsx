/**
 * app/dashboard/settings/page.tsx — Settings page Server Component.
 *
 * Fetches the three working-hours datasets in parallel before rendering
 * the client-side `SettingsPage`. All other settings tabs (Business,
 * Booking Rules, Policies, etc.) still use mock data — they will be
 * wired to the DB in a follow-up phase.
 *
 * ## Parallel fetching
 * `Promise.all` fires all three DB queries simultaneously. Typical cold
 * latency: < 30 ms on the same VPC as Supabase.
 *
 * ## noindex
 * Settings pages should never appear in search results.
 */

import type { Metadata } from "next";
import { getBusinessHours, getTimeOff, getLunchBreak } from "./hours-actions";
import { SettingsPage } from "./SettingsPage";

export const metadata: Metadata = {
  title: "Settings — T Creative Studio",
  description: "Business settings and configuration.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const [initialHours, initialTimeOff, initialLunchBreak] = await Promise.all([
    getBusinessHours(),
    getTimeOff(),
    getLunchBreak(),
  ]);

  return (
    <SettingsPage
      initialHours={initialHours}
      initialTimeOff={initialTimeOff}
      initialLunchBreak={initialLunchBreak}
    />
  );
}
