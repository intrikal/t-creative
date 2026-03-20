/**
 * site-data — Shared data loader for public pages.
 *
 * Fetches site content, business profile, and policies in parallel.
 * No auth required — these are public settings.
 *
 * Wrapped with React `cache()` so repeated calls within the same server
 * render (e.g. layout + page both calling getSiteData) are deduplicated
 * to a single set of DB queries.
 */
import { cache } from "react";
import {
  getSiteContent,
  getPublicBusinessProfile,
  getPublicPolicies,
} from "@/app/dashboard/settings/settings-actions";
import type {
  SiteContent,
  BusinessProfile,
  PolicySettings,
} from "@/app/dashboard/settings/settings-actions";

export type SiteData = {
  business: BusinessProfile;
  content: SiteContent;
  policies: PolicySettings;
};

export const getSiteData = cache(async (): Promise<SiteData> => {
  const [business, content, policies] = await Promise.all([
    getPublicBusinessProfile(),
    getSiteContent(),
    getPublicPolicies(),
  ]);
  return { business, content, policies };
});
