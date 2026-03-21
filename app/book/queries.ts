/**
 * Cached queries for the public booking page.
 * Services, reviews, and add-ons change infrequently.
 */
import { cacheTag, cacheLife } from "next/cache";
import { sql, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { profiles, services, reviews, serviceAddOns } from "@/db/schema";

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
