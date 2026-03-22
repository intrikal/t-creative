/**
 * public-reviews — Fetch featured reviews for the public landing page.
 *
 * No auth required. Queries the reviews table directly for featured,
 * approved reviews joined with profiles for client names.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reviews, profiles } from "@/db/schema";

/**
 * Flattened review shape returned to the public landing page.
 * Combines review columns with derived client display fields
 * (full name, initials) so the component doesn't need a second query.
 */
export interface FeaturedReview {
  /** Primary key from the `reviews` table. */
  id: number;
  /** Full display name assembled from profiles.firstName + profiles.lastName. */
  client: string;
  /** Two-letter initials used as avatar placeholder (e.g. "SM"). */
  initials: string;
  /** 1–5 star rating. */
  rating: number;
  /** Human-readable service name (e.g. "Volume Lash Full Set"). */
  serviceName: string | null;
  /** The review text written by the client. */
  body: string | null;
  /** Optional reply from staff, shown beneath the review. */
  staffResponse: string | null;
  /** ISO 8601 date string for display formatting on the client. */
  createdAt: string;
}

/**
 * Fetch the most recent featured reviews for the public landing page.
 *
 * Query details:
 * - SELECTs review fields (id, rating, body, serviceName, staffResponse, createdAt)
 *   plus the client's first/last name from profiles.
 * - LEFT JOINs `profiles` on `reviews.clientId = profiles.id` to get the
 *   reviewer's name. LEFT JOIN so reviews still appear even if the profile
 *   was deleted (falls back to "Anonymous").
 * - WHERE `isFeatured = true AND status = 'approved'` — both flags must be
 *   set by Trini from the admin Reviews dashboard before a review goes public.
 * - ORDER BY `createdAt DESC` — newest featured reviews first.
 * - LIMIT 5 — the landing page testimonials carousel shows at most 5.
 *
 * @returns Array of up to 5 FeaturedReview objects. Returns [] on error
 *          so the landing page renders gracefully without reviews.
 */
function toFeaturedReview(r: {
  id: number;
  rating: number;
  body: string | null;
  serviceName: string | null;
  staffResponse: string | null;
  createdAt: Date;
  firstName: string | null;
  lastName: string | null;
}): FeaturedReview {
  const first = r.firstName ?? "";
  const last = r.lastName ?? "";
  const client = [first, last].filter(Boolean).join(" ") || "Anonymous";
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "AN";
  return {
    id: r.id,
    client,
    initials,
    rating: r.rating,
    serviceName: r.serviceName,
    body: r.body,
    staffResponse: r.staffResponse,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getFeaturedReviews(): Promise<FeaturedReview[]> {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        serviceName: reviews.serviceName,
        staffResponse: reviews.staffResponse,
        createdAt: reviews.createdAt,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(reviews)
      .leftJoin(profiles, eq(reviews.clientId, profiles.id))
      .where(and(eq(reviews.isFeatured, true), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt))
      .limit(5);

    // Transform raw DB rows into the FeaturedReview shape:
    // - Assemble full name from first + last (fallback "Anonymous")
    // - Derive two-letter initials for avatar placeholders
    // - Convert createdAt Date to ISO string for serialisation across the
    //   server-action boundary (Date objects can't cross RSC → client)
    return rows.map(toFeaturedReview);
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/**
 * Fetch all featured reviews for the public testimonials page.
 * Same query as getFeaturedReviews but without the limit of 5.
 */
export async function getAllFeaturedReviews(): Promise<FeaturedReview[]> {
  try {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        serviceName: reviews.serviceName,
        staffResponse: reviews.staffResponse,
        createdAt: reviews.createdAt,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(reviews)
      .leftJoin(profiles, eq(reviews.clientId, profiles.id))
      .where(and(eq(reviews.isFeatured, true), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt));

    return rows.map(toFeaturedReview);
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/**
 * Fetch aggregate review stats (total count + avg rating) across all
 * approved reviews. Used by the testimonials page for JSON-LD and display.
 */
export async function getReviewStats(): Promise<{ count: number; avg: number }> {
  try {
    const [row] = await db
      .select({
        count: sql<number>`count(*)`,
        avg: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)`,
      })
      .from(reviews)
      .where(eq(reviews.status, "approved"));

    return { count: Number(row.count), avg: Number(row.avg) };
  } catch (err) {
    Sentry.captureException(err);
    return { count: 0, avg: 0 };
  }
}
