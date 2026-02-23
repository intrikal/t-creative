/**
 * app/sitemap.ts — XML sitemap generator
 *
 * ## What this file does
 * Next.js automatically calls the default export of `app/sitemap.ts` and serves
 * the result at `/sitemap.xml`. Google and other crawlers fetch this URL to
 * discover all indexable pages without having to follow every link on the site.
 *
 * ## Priority and changeFrequency guidance
 * - `priority` (0.0–1.0): relative importance hint to crawlers. The home page
 *   and booking page are the highest-value pages for driving business, so both
 *   get elevated priority.
 * - `changeFrequency`: how often the content is expected to change. The booking
 *   page is "weekly" because services, pricing, and hours can change at any time
 *   as Trini updates her onboarding data.
 *
 * ## Static vs. dynamic entries
 * Marketing routes (`/services`, `/portfolio`, etc.) are static — they're listed
 * as an array and mapped uniformly.
 *
 * The booking page (`/book/tcreativestudio`) is listed as a static entry for now
 * because there is only one studio. Phase 2 should make this dynamic:
 *
 * ```ts
 * // Phase 2: generate one entry per admin profile
 * const adminProfiles = await db
 *   .select({ onboardingData: profiles.onboardingData })
 *   .from(profiles)
 *   .where(eq(profiles.role, "admin"));
 *
 * const bookingEntries = adminProfiles.map(p => {
 *   const slug = (p.onboardingData as any)?.studioName
 *     ?.toLowerCase().replace(/\s+/g, "");
 *   return { url: `${BASE_URL}/book/${slug}`, ... };
 * });
 * ```
 *
 * ## BASE_URL
 * Must match the canonical domain in `app/book/[slug]/page.tsx` and the
 * `alternates.canonical` metadata field. If the domain changes, update it here
 * and in page.tsx simultaneously.
 */

import type { MetadataRoute } from "next";

const BASE_URL = "https://tcreativestudio.com";

/**
 * sitemap — returns the full list of public URLs for Google to index.
 *
 * @returns Array of sitemap entries consumed by Next.js to generate `/sitemap.xml`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Marketing site routes — updated monthly at most.
  const routes = ["", "/services", "/portfolio", "/training", "/consulting", "/about", "/contact"];

  return [
    ...routes.map((route) => ({
      url: `${BASE_URL}${route}`,
      lastModified: new Date(),
      changeFrequency: (route === "" ? "weekly" : "monthly") as "weekly" | "monthly",
      priority: route === "" ? 1.0 : 0.8,
    })),

    // Public booking storefront — second-highest priority after home.
    // Listed explicitly (not derived from DB) until multi-studio support lands.
    {
      url: `${BASE_URL}/book/tcreativestudio`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
  ];
}
