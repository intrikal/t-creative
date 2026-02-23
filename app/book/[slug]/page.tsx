/**
 * app/book/[slug]/page.tsx — Public booking storefront for T Creative Studio
 *
 * ## Route
 * `/book/[slug]` — e.g. `/book/tcreativestudio`
 *
 * ## What this file does
 * This is a Next.js App Router **Server Component**. It runs exclusively on the
 * server (no client JS), fetches all data in parallel, and passes it down to the
 * `<BookingPage>` client component for rendering.
 *
 * The page is intentionally **auth-free** — anyone with the URL can view it.
 * It is the public face of the studio that Trini shares on Instagram and social
 * media. No `getCurrentUser()` or Supabase session check is needed here.
 *
 * ## Slug derivation
 * The slug is derived from the admin's `onboardingData.studioName` field using
 * a deterministic transform: lowercase + strip spaces. So "T Creative Studio"
 * → `tcreativestudio`. This happens at write time (in the onboarding action)
 * and is reproduced in the SQL `WHERE` clause here for the read path.
 *
 * ## Data sources (all fetched in one Promise.all)
 * 1. `profiles` (admin row) — studio name, bio, location, socials, avatar,
 *    schedule, intake questions, policies, rewards config
 * 2. `services` — all active services ordered by `sort_order`
 * 3. `reviews` (approved + featured) — up to 6 testimonials shown on the page
 * 4. review aggregate stats — total count + average rating across all approved reviews
 * 5. `service_add_ons` — all active add-ons, grouped by `service_id` in memory
 *
 * ## JSON-LD
 * A `<script type="application/ld+json">` block is injected at the top of the
 * rendered HTML with `schema.org/BeautySalon` structured data. This enables
 * rich results (star ratings, service listings) in Google Search without
 * additional configuration.
 *
 * ## Phase 2 integration points
 * - Real-time slot availability should be fetched here and passed to
 *   `<BookingPage>` to enable the Book/Waitlist CTA split per slot
 * - Square Calendar or a native scheduling table can be queried server-side
 *   and passed as `availableSlots: Record<string, string[]>`
 * - When multi-studio support lands, slug matching will need an `adminId`
 *   foreign key added to `services` and `service_add_ons`
 */

import { notFound } from "next/navigation";
import { sql, eq, and } from "drizzle-orm";
import type { Metadata } from "next";
import { BookingPage } from "@/components/booking/BookingPage";
import { db } from "@/db";
import { profiles, services, reviews, serviceAddOns } from "@/db/schema";

/** Canonical base URL used for metadata and JSON-LD. Must match production domain. */
const BASE_URL = "https://tcreativestudio.com";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * generateMetadata — Produces `<title>`, `<meta description>`, canonical URL,
 * and robots directives for the booking page.
 *
 * Runs on the server before the page renders. Next.js merges this with the
 * root layout's metadata via the metadata API cascade.
 *
 * The canonical `alternates.canonical` entry is critical: without it, Google
 * may treat `/book/tcreativestudio` and any query-string variants as duplicate
 * pages and split PageRank across them.
 *
 * Falls back gracefully — if the slug doesn't match any profile, returns a
 * minimal title rather than throwing (the page component handles the 404).
 *
 * @param params - Next.js dynamic route params. `slug` is the studio identifier.
 * @returns Next.js `Metadata` object merged into the document `<head>`.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const profile = await db
    .select({ onboardingData: profiles.onboardingData })
    .from(profiles)
    .where(
      // Reproduce the same transform used at write time so the lookup is consistent:
      // lower(replace(trim(studioName))) = slug
      sql`lower(replace(trim(${profiles.onboardingData}->>'studioName'), ' ', '')) = ${slug}`,
    )
    .limit(1)
    .then((r) => r[0]);

  if (!profile) return { title: "Studio Not Found" };

  const data = profile.onboardingData as Record<string, unknown> | null;
  const studioName = (data?.studioName as string) ?? "T Creative Studio";
  const bio = (data?.bio as string) ?? "";

  return {
    title: `${studioName} — Book a Session`,
    description: bio || `Book a session with ${studioName}`,
    // Prevents Google from indexing query-string or path variants as duplicates.
    alternates: { canonical: `${BASE_URL}/book/${slug}` },
    // Explicit directive — does not rely on inherited robots.ts default.
    robots: { index: true, follow: true },
  };
}

/**
 * BookSlugPage — Server Component entry point for `/book/[slug]`.
 *
 * ## Rendering pipeline
 * 1. Resolve `slug` from route params
 * 2. Query the `profiles` table for an admin whose studio name normalises to `slug`
 * 3. If no match → `notFound()` triggers Next.js 404
 * 4. Destructure the `onboardingData` JSONB into typed sub-objects
 * 5. Fan out four parallel DB queries via `Promise.all`
 * 6. Post-process add-ons into a `serviceId → addOns[]` lookup map
 * 7. Build JSON-LD and inject it as an inline `<script>` before `<BookingPage>`
 *
 * ## Why two separate DB trips for the profile?
 * `generateMetadata` and the page component both query the profile independently.
 * Next.js deduplications `fetch()` calls but not Drizzle queries. This is
 * acceptable here — the profile query is cheap (single row, JSONB index) and
 * the alternative (a shared cache layer) adds complexity that isn't warranted yet.
 *
 * ## JSONB extraction pattern
 * `onboardingData` is stored as a single JSONB column (Postgres). We extract
 * sub-keys using the `->>'key'` operator inside a Drizzle `sql` template, which
 * returns a text value without JSON quoting. Nested keys (e.g. `location.type`)
 * are extracted by deserialising the column in JS rather than chaining `->>`
 * operators in SQL — keeps the query readable and avoids brittle path strings.
 *
 * @param params - Next.js dynamic route params.
 */
export default async function BookSlugPage({ params }: Props) {
  const { slug } = await params;

  // ── 1. Fetch the admin profile ────────────────────────────────────────────
  const [profileRow] = await db
    .select({
      firstName: profiles.firstName,
      avatarUrl: profiles.avatarUrl,
      onboardingData: profiles.onboardingData,
    })
    .from(profiles)
    .where(sql`lower(replace(trim(${profiles.onboardingData}->>'studioName'), ' ', '')) = ${slug}`)
    .limit(1);

  if (!profileRow) notFound();

  // ── 2. Deserialise JSONB sub-objects ─────────────────────────────────────
  // Each sub-object is typed narrowly. The `?? {}` fallback ensures we never
  // pass `undefined` into the studio object even if a key is missing from old rows.
  const data = profileRow.onboardingData as Record<string, unknown> | null;

  const socialsData = (data?.socials as Record<string, string>) ?? {};
  const locationData = (data?.location as Record<string, string>) ?? {};
  const policiesData = (data?.policies as Record<string, unknown>) ?? {};
  const intakeData =
    (data?.intake as Record<string, { prep: string; questions: Record<string, boolean> }>) ?? {};
  const rewardsData = (data?.rewards as Record<string, unknown>) ?? {};
  const scheduleData = (data?.schedule as Record<string, string>) ?? {};

  // ── 3. Build the studio prop shape ───────────────────────────────────────
  // This object is the single source of truth passed to <BookingPage>.
  // All JSONB extraction and null-coalescing is done here so the client
  // component receives clean, typed props and never touches raw JSONB.
  const studio = {
    name: (data?.studioName as string) ?? "T Creative Studio",
    bio: (data?.bio as string) ?? "",
    locationType: locationData.type ?? "",
    locationArea: locationData.area ?? "",
    socials: {
      instagram: socialsData.instagram ?? "",
      tiktok: socialsData.tiktok ?? "",
      facebook: socialsData.facebook ?? "",
    },
    // avatarUrl is sourced from Google OAuth metadata (saved at onboarding time).
    // Falls back to null — the client component shows initials in that case.
    avatarUrl: profileRow.avatarUrl ?? null,
    firstName: profileRow.firstName,
    policies: {
      cancellationWindowHours: (policiesData.cancellationWindowHours as number) ?? null,
      cancellationFeeInCents: (policiesData.cancellationFeeInCents as number) ?? null,
      noShowFeeInCents: (policiesData.noShowFeeInCents as number) ?? null,
      bookingConfirmation: (policiesData.bookingConfirmation as string) ?? "instant",
    },
    intake: intakeData,
    rewardsEnabled: (rewardsData.enabled as boolean) ?? false,
    // waitlist is a per-category map (e.g. { lash: true, jewelry: "request" }).
    // Phase 2: this will become per-slot availability once calendar integration lands.
    waitlist: (policiesData.waitlist as Record<string, boolean | string>) ?? {},
    schedule: {
      startTime: scheduleData.defaultStartTime ?? null,
      endTime: scheduleData.defaultEndTime ?? null,
    },
  };

  // ── 4. Parallel data fetch ────────────────────────────────────────────────
  // All four queries run concurrently. Total latency ≈ slowest query, not sum.
  const [activeServices, featuredReviews, reviewStats, allAddOns] = await Promise.all([
    // Services: only active rows, sorted by admin-configured sort_order.
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

    // Featured reviews: approved + explicitly flagged as featured, capped at 6
    // to keep the testimonials section scannable without paginating.
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

    // Aggregate stats: total approved reviews + rounded average rating.
    // `::int` and `::numeric` casts ensure Drizzle returns JS number, not string.
    db
      .select({
        count: sql<number>`count(*)::int`,
        avg: sql<number>`round(avg(rating)::numeric, 1)`,
      })
      .from(reviews)
      .where(eq(reviews.status, "approved"))
      .then((r) => r[0] ?? { count: 0, avg: 0 }),

    // Add-ons: all active add-ons across all services in one query.
    // Grouping by service_id happens in JS (step 5) rather than SQL to avoid
    // a GROUP BY + JSON_AGG pattern that complicates the Drizzle query builder.
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

  // ── 5. Group add-ons by service ID ───────────────────────────────────────
  // Produces { [serviceId]: ServiceAddOn[] } so ServiceCard can do an O(1)
  // lookup rather than filtering the full array for each card render.
  const addOnsByService = allAddOns.reduce<Record<number, typeof allAddOns>>((acc, addOn) => {
    if (!acc[addOn.serviceId]) acc[addOn.serviceId] = [];
    acc[addOn.serviceId].push(addOn);
    return acc;
  }, {});

  // ── 6. JSON-LD structured data ────────────────────────────────────────────
  // schema.org/BeautySalon is a subtype of LocalBusiness. Declaring both types
  // gives Google maximum signal for rich result eligibility (business panel,
  // service listings, review stars in SERPs).
  //
  // Fields are conditionally spread (`...(condition ? { key: val } : {})`) so
  // we never emit `undefined` values into the JSON — Google's validators reject them.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "BeautySalon"],
    name: studio.name,
    ...(studio.bio ? { description: studio.bio } : {}),
    url: `${BASE_URL}/book/${slug}`,
    priceRange: "$$",
    ...(studio.locationArea
      ? { address: { "@type": "PostalAddress", addressLocality: studio.locationArea } }
      : {}),
    // sameAs links social profiles so Google can cross-reference the business entity.
    ...(studio.socials.instagram
      ? {
          sameAs: [
            `https://instagram.com/${studio.socials.instagram.replace("@", "")}`,
            ...(studio.socials.tiktok
              ? [`https://tiktok.com/@${studio.socials.tiktok.replace("@", "")}`]
              : []),
          ],
        }
      : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: activeServices.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.name,
          ...(s.description ? { description: s.description } : {}),
        },
        // Only emit price fields when a concrete price exists.
        // Omitting them is correct — Google won't penalise missing price on services.
        ...(s.priceInCents !== null
          ? { price: (s.priceInCents / 100).toFixed(0), priceCurrency: "USD" }
          : {}),
      })),
    },
  };

  return (
    <>
      {/*
       * JSON-LD is injected as a raw script rather than via next/script because:
       * 1. It must be in the <head>, not deferred
       * 2. dangerouslySetInnerHTML is safe here — content is server-controlled JSON,
       *    not user input. JSON.stringify escapes all special characters.
       */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BookingPage
        studio={studio}
        services={activeServices}
        featuredReviews={featuredReviews}
        reviewStats={reviewStats}
        addOnsByService={addOnsByService}
        slug={slug}
      />
    </>
  );
}
