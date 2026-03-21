/**
 * site-data — Shared data loader for public pages.
 *
 * Fetches site content, business profile, and policies in parallel.
 * No auth required — these are public settings.
 *
 * Uses "use cache" with cacheTag for cross-request caching and
 * automatic request-level deduplication.
 */
import { cacheTag, cacheLife } from "next/cache";
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

export async function getSiteData(): Promise<SiteData> {
  "use cache";
  cacheTag("site-content");
  cacheLife("days");

  const [business, content, policies] = await Promise.all([
    getPublicBusinessProfile(),
    getSiteContent(),
    getPublicPolicies(),
  ]);
  return { business, content, policies };
}
