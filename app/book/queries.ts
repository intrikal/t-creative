/**
 * app/book/queries.ts — Cached queries for the public booking page.
 *
 * Fetches everything the booking page needs in one call: the studio profile,
 * active services, featured reviews, aggregate review stats, and service add-ons.
 * Results are cached for hours because this data changes infrequently.
 *
 * No authentication required — this is a public page.
 *
 * @module book/queries
 */
import { cacheTag, cacheLife } from "next/cache";
import { sql, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { profiles, services, reviews, serviceAddOns } from "@/db/schema";

/**
 * Loads all data the public booking page needs for a given studio slug.
 * Cached ("use cache") with tag "booking-page" and a lifetime of hours.
 *
 * First, looks up the studio profile by slug, then runs 4 queries in parallel:
 *
 * Profile lookup:
 *   SELECT firstName, avatarUrl, onboardingData
 *   FROM   profiles
 *   WHERE  lower(replace(trim(onboardingData->>'studioName'), ' ', '')) = <slug>
 *   LIMIT 1
 *   → finds the admin profile whose studio name, lowercased and stripped of spaces,
 *     matches the URL slug. Returns null if no match (invalid studio URL).
 *
 * Parallel queries (only run if profile exists):
 *
 * 1. Active services —
 *    SELECT id, category, name, priceInCents, depositInCents, durationMinutes, description
 *    FROM   services
 *    WHERE  isActive = true
 *    ORDER BY sortOrder
 *    → every bookable service, sorted by the admin's custom display order.
 *
 * 2. Featured reviews —
 *    SELECT reviews.id, rating, body, serviceName, profiles.firstName
 *    FROM   reviews
 *    INNER JOIN profiles ON reviews.clientId = profiles.id
 *      → pulls the reviewer's first name for display
 *    WHERE  reviews.status = 'approved' AND reviews.isFeatured = true
 *    LIMIT 6
 *    → up to 6 hand-picked testimonials shown on the booking page.
 *
 * 3. Aggregate review stats —
 *    SELECT count(*)::int, round(avg(rating)::numeric, 1)
 *    FROM   reviews
 *    WHERE  status = 'approved'
 *    → total review count and average star rating for the "X reviews, Y.Z stars" badge.
 *
 * 4. Active add-ons —
 *    SELECT id, serviceId, name, description, priceInCents, additionalMinutes
 *    FROM   service_add_ons
 *    WHERE  isActive = true
 *    → upsell options (e.g. "Add volume fans +$20, +15 min") shown during booking.
 */
export async function getBookingPageData(slug: string) {
  "use cache";
  cacheTag("booking-page");
  cacheLife("hours");

  // Fetch the admin profile
  const [profileRow] = await db
    .select({
      firstName: profiles.firstName,
      avatarUrl: profiles.avatarUrl,
      onboardingData: profiles.onboardingData,
    })
    .from(profiles)
    .where(sql`lower(replace(trim(${profiles.onboardingData}->>'studioName'), ' ', '')) = ${slug}`)
    .limit(1);

  if (!profileRow) return null;

  // Parallel data fetch
  const [activeServices, featuredReviews, reviewStats, allAddOns] = await Promise.all([
    db
      .select({
        id: services.id,
        category: services.category,
        name: services.name,
        priceInCents: services.priceInCents,
        depositInCents: services.depositInCents,
        durationMinutes: services.durationMinutes,
        description: services.description,
      })
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(services.sortOrder),

    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        serviceName: reviews.serviceName,
        clientFirstName: profiles.firstName,
      })
      .from(reviews)
      .innerJoin(profiles, eq(reviews.clientId, profiles.id))
      .where(and(eq(reviews.status, "approved"), eq(reviews.isFeatured, true)))
      .limit(6),

    db
      .select({
        count: sql<number>`count(*)::int`,
        avg: sql<number>`round(avg(rating)::numeric, 1)`,
      })
      .from(reviews)
      .where(eq(reviews.status, "approved"))
      .then((r) => r[0] ?? { count: 0, avg: 0 }),

    db
      .select({
        id: serviceAddOns.id,
        serviceId: serviceAddOns.serviceId,
        name: serviceAddOns.name,
        description: serviceAddOns.description,
        priceInCents: serviceAddOns.priceInCents,
        additionalMinutes: serviceAddOns.additionalMinutes,
      })
      .from(serviceAddOns)
      .where(eq(serviceAddOns.isActive, true)),
  ]);

  return { profileRow, activeServices, featuredReviews, reviewStats, allAddOns };
}
