/**
 * app/sitemap.ts — XML sitemap generator
 *
 * ## What this file does
 * Next.js automatically calls the default export of `app/sitemap.ts` and serves
 * the result at `/sitemap.xml`. Google and other crawlers fetch this URL to
 * discover all indexable pages without having to follow every link on the site.
 *
 * ## Dynamic entries
 * This sitemap is async so it can query the database at build time (or on-demand
 * with ISR) to generate one entry per published content item:
 *
 * - `/training/[slug]`  — one entry per active training program
 * - `/shop/[slug]`      — one entry per published product
 * - `/portfolio`        — single entry; portfolio items have no individual pages
 *
 * When individual pages are added for these routes they will automatically appear
 * in the sitemap as new items are published — no manual edits needed.
 *
 * ## Adding blog posts
 * When a blog feature is built, import a `getPublishedPosts()` action and map
 * each post to `${BASE_URL}/blog/${post.slug}` following the same pattern below.
 *
 * ## Priority and changeFrequency guidance
 * - `priority` (0.0–1.0): relative importance hint to crawlers.
 * - `changeFrequency`: how often the content is expected to change.
 *
 * ## BASE_URL
 * Must match the canonical domain in `app/book/[slug]/page.tsx` and the
 * `alternates.canonical` metadata field. If the domain changes, update it here
 * and in those files simultaneously.
 */

import type { MetadataRoute } from "next";
import { getPublishedProducts } from "@/app/shop/queries";
import { getPublishedPrograms } from "@/app/training/actions";
import { SITE_URL } from "@/lib/site-config";

const BASE_URL = SITE_URL;

/**
 * sitemap — returns the full list of public URLs for Google to index.
 *
 * @returns Array of sitemap entries consumed by Next.js to generate `/sitemap.xml`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch dynamic content in parallel
  const [programs, products] = await Promise.all([getPublishedPrograms(), getPublishedProducts()]);

  // Marketing site routes — updated monthly at most.
  const staticRoutes = [
    "",
    "/services",
    "/portfolio",
    "/training",
    "/consulting",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/events/corporate",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : 0.8,
  }));

  // Public booking storefront — listed explicitly until multi-studio support lands.
  const bookingEntry: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/book/tcreativestudio`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Individual training program pages — one entry per active program.
  // Requires app/training/[slug]/page.tsx to exist for these URLs to resolve.
  const trainingEntries: MetadataRoute.Sitemap = programs.map((program) => ({
    url: `${BASE_URL}/training/${program.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Individual shop product pages — one entry per published product.
  // Requires app/shop/[slug]/page.tsx to exist for these URLs to resolve.
  const shopEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${BASE_URL}/shop/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...bookingEntry, ...trainingEntries, ...shopEntries];
}
