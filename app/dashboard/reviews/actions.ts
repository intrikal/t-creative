/**
 * Server actions for the Reviews dashboard (`/dashboard/reviews`).
 *
 * Queries the `reviews` table joined with `profiles` for client names.
 * Provides CRUD operations: fetch, approve, reject, feature, reply.
 *
 * DB status enum: pending | approved | rejected
 * UI maps: isFeatured=true → "featured", status=rejected → "hidden"
 *
 * ── Tables touched ──────────────────────────────────────────────────
 *  reviews   – one row per client review (rating, body, status, staff response)
 *  profiles  – user identity (name, email, avatar) — joined for client names
 *  bookings  – appointment records — joined to verify assistant ownership
 *
 * ── Views that consume these actions ────────────────────────────────
 *  /dashboard/reviews             – admin view (getReviews, getReviewStats, mutations)
 *  /dashboard/reviews (assistant) – assistant view (getAssistantReviews, assistantSaveReply)
 *  Public booking page            – tagged "booking-page"; cache busted on every mutation
 *
 * ── External side-effects ───────────────────────────────────────────
 *  Next.js cache  – revalidatePath("/dashboard/reviews") + updateTag("booking-page")
 *                   on every mutation so both the dashboard and the public page refresh.
 *  Sentry         – error capture on every catch block.
 *
 * @module reviews/actions
 * @see {@link ./ReviewsPage.tsx} — client component consuming this data
 */
"use server";

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reviews, profiles, bookings } from "@/db/schema";
import { requireAdmin, getCurrentUser } from "@/lib/auth";
import { createActionLimiter } from "@/lib/middleware/action-rate-limit";

async function getAssistantUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

const approveReviewLimiter = createActionLimiter("review-approve", {
  requests: 20,
  window: "60 s",
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ReviewStatus = "pending" | "approved" | "featured" | "hidden";
export type ReviewSource = "google" | "website" | "instagram" | "yelp";

export type ReviewRow = {
  id: number;
  client: string;
  initials: string;
  rating: number;
  serviceName: string;
  source: ReviewSource | null;
  date: string;
  text: string;
  status: ReviewStatus;
  reply: string | null;
};

export type ReviewStats = {
  totalReviews: number;
  avgRating: number;
  pendingCount: number;
  featuredCount: number;
  withReplyCount: number;
  fiveStarCount: number;
  ratingDist: { stars: number; count: number; pct: number }[];
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * getReviews — Fetch all reviews for the admin dashboard table.
 * Returns up to 500 reviews with client name, rating, and status info.
 */
export async function getReviews(): Promise<ReviewRow[]> {
  try {
    await getUser();

    /*
     * ── Drizzle query: all reviews with client profile info ────────
     *
     * SELECT columns:
     *   reviews.id               – unique review identifier
     *   profiles.firstName/lastName – the client's name (for display)
     *   reviews.rating           – integer 1-5 star rating
     *   reviews.serviceName      – which service was reviewed (stored as text on review)
     *   reviews.source           – where the review came from (google, website, instagram, yelp)
     *   reviews.body             – the review text written by the client
     *   reviews.status           – workflow status: "pending" | "approved" | "rejected"
     *   reviews.isFeatured       – boolean flag for featured reviews shown on the public page
     *   reviews.staffResponse    – admin/assistant reply text (NULL if no reply yet)
     *   reviews.createdAt        – when the review was submitted
     *
     * FROM reviews
     *   LEFT JOIN profiles ON reviews.client_id = profiles.id
     *     – LEFT (not INNER) because the client profile may have been deleted or
     *       the review may have been imported without a linked profile (e.g. from
     *       Google reviews). We still want to show the review even without a name.
     *
     * ORDER BY reviews.created_at DESC – newest reviews first.
     * LIMIT 500 – safety cap to avoid loading thousands of rows into memory.
     */
    const rows = await db
      .select({
        id: reviews.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        rating: reviews.rating,
        serviceName: reviews.serviceName,
        source: reviews.source,
        body: reviews.body,
        status: reviews.status,
        isFeatured: reviews.isFeatured,
        staffResponse: reviews.staffResponse,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .leftJoin(profiles, eq(reviews.clientId, profiles.id))
      .orderBy(desc(reviews.createdAt))
      .limit(500);

    /*
     * Post-processing: map DB rows to UI-friendly ReviewRow objects.
     * - Builds full name + initials from firstName/lastName (falls back to "Unknown"/"?").
     * - Maps the DB status + isFeatured into a single UI status enum:
     *     isFeatured && approved → "featured"
     *     rejected              → "hidden"
     *     otherwise             → the raw DB status ("pending" or "approved")
     * - Formats createdAt as a human-readable date string (e.g. "Mar 20, 2026").
     */
    // Transform each DB row into a ReviewRow for the UI.
    // .filter(Boolean) on name parts drops empty strings from null first/last names.
    // The combined status logic (isFeatured + status) collapses the DB's two-column
    // representation into a single UI enum for simpler rendering.
    return rows.map((r) => {
      const first = r.firstName ?? "";
      const last = r.lastName ?? "";
      const name = [first, last].filter(Boolean).join(" ") || "Unknown";
      const initials = (first[0] ?? "?").toUpperCase() + (last[0] ?? "").toUpperCase();

      let uiStatus: ReviewStatus;
      if (r.isFeatured && r.status === "approved") {
        uiStatus = "featured";
      } else if (r.status === "rejected") {
        uiStatus = "hidden";
      } else {
        uiStatus = r.status as ReviewStatus;
      }

      return {
        id: r.id,
        client: name,
        initials,
        rating: r.rating,
        serviceName: r.serviceName ?? "General",
        source: (r.source as ReviewSource) ?? null,
        date: new Date(r.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        text: r.body ?? "",
        status: uiStatus,
        reply: r.staffResponse,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * getReviewStats — Aggregate statistics for the reviews dashboard header cards.
 * Runs two queries in parallel for speed, then merges the results.
 */
export async function getReviewStats(): Promise<ReviewStats> {
  try {
    await getUser();

    /*
     * Two queries run in parallel via Promise.all:
     *
     * ── Query 1: summary aggregates (single row) ───────────────────
     *
     * SELECT:
     *   count(*)                         – total number of reviews across all statuses
     *   coalesce(round(avg(rating),1),0) – average star rating rounded to 1 decimal;
     *                                      COALESCE returns 0 if there are no reviews
     *   count(*) FILTER (WHERE status = 'pending')      – how many reviews await moderation
     *   count(*) FILTER (WHERE is_featured = true)      – how many are featured on the public page
     *   count(*) FILTER (WHERE staff_response IS NOT NULL) – how many have an admin reply
     *   count(*) FILTER (WHERE rating = 5)              – count of 5-star reviews
     *
     * FROM reviews (no joins needed — all data lives on the reviews table).
     * No WHERE — aggregates across the entire table.
     *
     * ── Query 2: rating distribution (one row per star value) ──────
     *
     * SELECT: reviews.rating, count(*)
     * FROM reviews
     * GROUP BY reviews.rating  – one bucket per distinct rating value (1-5)
     * ORDER BY reviews.rating DESC – 5 stars first, 1 star last
     *
     * The result is used to build the bar-chart distribution on the dashboard.
     */
    // Promise.all runs two independent aggregate queries in parallel — summary
    // stats and per-rating distribution have no data dependency between them.
    const [statsRow, ratingRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          avgRating: sql<number>`coalesce(round(avg(${reviews.rating}), 1), 0)`,
          pending: sql<number>`count(*) filter (where ${reviews.status} = 'pending')`,
          featured: sql<number>`count(*) filter (where ${reviews.isFeatured} = true)`,
          withReply: sql<number>`count(*) filter (where ${reviews.staffResponse} is not null)`,
          fiveStar: sql<number>`count(*) filter (where ${reviews.rating} = 5)`,
        })
        .from(reviews)
        .then((r) => r[0]),
      db
        .select({
          rating: reviews.rating,
          count: sql<number>`count(*)`,
        })
        .from(reviews)
        .groupBy(reviews.rating)
        .orderBy(desc(reviews.rating)),
    ]);

    /*
     * Post-processing: merge the two query results into a single ReviewStats object.
     * ratingMap converts the grouped rows into a lookup Map<starValue, count>.
     * ratingDist ensures all 5 star levels are present (even if 0 reviews at that level)
     * and computes each level's percentage of the total.
     */
    const total = Number(statsRow.total);
    // Build Map<starValue, count> from the grouped rating rows for O(1) lookups.
    const ratingMap = new Map(ratingRows.map((r) => [r.rating, Number(r.count)]));

    // .map() over the fixed [5,4,3,2,1] array ensures all 5 star levels appear
    // in the output even if a level has zero reviews — the UI bar chart needs
    // all 5 buckets. Percentage is computed inline per level.
    const ratingDist = [5, 4, 3, 2, 1].map((stars) => {
      const count = ratingMap.get(stars) ?? 0;
      return {
        stars,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    return {
      totalReviews: total,
      avgRating: Number(statsRow.avgRating),
      pendingCount: Number(statsRow.pending),
      featuredCount: Number(statsRow.featured),
      withReplyCount: Number(statsRow.withReply),
      fiveStarCount: Number(statsRow.fiveStar),
      ratingDist,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * approveReview — Move a review from "pending" to "approved" so it appears on the public page.
 *
 * UPDATE reviews SET status = 'approved', updated_at = NOW() WHERE id = :reviewId
 *
 * Side-effects:
 *  - revalidatePath("/dashboard/reviews") — refresh the admin dashboard.
 *  - updateTag("booking-page") — bust the public booking page cache so the
 *    newly approved review shows up for visitors.
 */
export async function approveReview(reviewId: number) {
  try {
    z.number().int().positive().parse(reviewId);
    await approveReviewLimiter();
    await getUser();
    await db
      .update(reviews)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    revalidatePath("/dashboard/reviews");
    updateTag("booking-page");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * rejectReview — Hide a review by setting status to "rejected" and clearing the featured flag.
 *
 * UPDATE reviews
 *   SET status = 'rejected', is_featured = false, updated_at = NOW()
 *   WHERE id = :reviewId
 *
 * is_featured is forced to false because a rejected review must not appear on the public page.
 *
 * Side-effects: revalidatePath("/dashboard/reviews") + updateTag("booking-page").
 */
export async function rejectReview(reviewId: number) {
  try {
    z.number().int().positive().parse(reviewId);
    await getUser();
    await db
      .update(reviews)
      .set({ status: "rejected", isFeatured: false, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    revalidatePath("/dashboard/reviews");
    updateTag("booking-page");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * featureReview — Promote a review to "featured" so it's highlighted on the public booking page.
 *
 * UPDATE reviews
 *   SET is_featured = true, status = 'approved', updated_at = NOW()
 *   WHERE id = :reviewId
 *
 * Also forces status to "approved" in case the review was still pending — a featured
 * review must be approved to appear publicly.
 *
 * Side-effects: revalidatePath("/dashboard/reviews") + updateTag("booking-page").
 */
export async function featureReview(reviewId: number) {
  try {
    z.number().int().positive().parse(reviewId);
    await getUser();
    await db
      .update(reviews)
      .set({ isFeatured: true, status: "approved", updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    revalidatePath("/dashboard/reviews");
    updateTag("booking-page");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * unfeatureReview — Remove the "featured" highlight from a review. The review
 * stays approved and visible, just no longer prominently displayed.
 *
 * UPDATE reviews SET is_featured = false, updated_at = NOW() WHERE id = :reviewId
 *
 * Side-effects: revalidatePath("/dashboard/reviews") + updateTag("booking-page").
 */
export async function unfeatureReview(reviewId: number) {
  try {
    z.number().int().positive().parse(reviewId);
    await getUser();
    await db
      .update(reviews)
      .set({ isFeatured: false, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    revalidatePath("/dashboard/reviews");
    updateTag("booking-page");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * saveReply — Admin saves (or clears) a reply to a client's review.
 *
 * UPDATE reviews
 *   SET staff_response    = :reply (or NULL if empty — clearing the reply),
 *       staff_responded_at = NOW() (or NULL if clearing),
 *       updated_at         = NOW()
 *   WHERE id = :reviewId
 *
 * If the reply is empty/whitespace-only, both staff_response and staff_responded_at
 * are set to NULL, effectively deleting the reply.
 *
 * Side-effects: revalidatePath("/dashboard/reviews") + updateTag("booking-page").
 */
export async function saveReply(reviewId: number, reply: string) {
  try {
    z.number().int().positive().parse(reviewId);
    z.string().parse(reply);
    await getUser();
    await db
      .update(reviews)
      .set({
        staffResponse: reply.trim() || null,
        staffRespondedAt: reply.trim() ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));
    revalidatePath("/dashboard/reviews");
    updateTag("booking-page");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Assistant reviews types                                            */
/* ------------------------------------------------------------------ */

export type AssistantReviewRow = {
  id: number;
  client: string;
  clientInitials: string;
  rating: number;
  service: string;
  source: string | null;
  date: string;
  dateKey: string;
  comment: string;
  replied: boolean;
  replyText: string | null;
};

export type AssistantReviewStats = {
  totalReviews: number;
  avgRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  thisMonthCount: number;
  responseRate: number;
  repliedCount: number;
  ratingDist: { stars: number; count: number }[];
};

export type AssistantReviewsData = {
  reviews: AssistantReviewRow[];
  stats: AssistantReviewStats;
};

/* ------------------------------------------------------------------ */
/*  Assistant reviews queries                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetches approved reviews where the logged-in assistant was the
 * assigned staff on the booking. Assistants only see approved/featured
 * reviews — not pending or rejected ones.
 */
export async function getAssistantReviews(): Promise<AssistantReviewsData> {
  try {
    const user = await getAssistantUser();

    /*
     * ── Drizzle query: approved/featured reviews for this assistant ──
     *
     * SELECT columns:
     *   reviews.id, rating, serviceName, source, body, staffResponse, createdAt
     *     – the review's own fields
     *   profiles.firstName, lastName
     *     – the reviewing client's name (for display)
     *
     * FROM reviews
     *   INNER JOIN bookings ON reviews.booking_id = bookings.id
     *     – INNER because we only want reviews that are linked to a real booking.
     *       This join also gives us bookings.staff_id to filter by the current assistant.
     *
     *   LEFT JOIN profiles ON reviews.client_id = profiles.id
     *     – LEFT because the client profile might be missing (deleted account or
     *       imported review). We still show the review with "Unknown" as the name.
     *
     * WHERE:
     *   bookings.staff_id = user.id
     *     – only reviews for bookings where this assistant was the assigned staff.
     *   AND (reviews.status = 'approved' OR reviews.is_featured = true)
     *     – assistants can only see approved or featured reviews, not pending/rejected.
     *       OR is used because a featured review may technically have status "approved",
     *       but this covers edge cases if data is inconsistent.
     *
     * ORDER BY reviews.created_at DESC – newest reviews first.
     */
    // Fetch approved + featured reviews for this assistant's bookings in one query
    const allRows = await db
      .select({
        id: reviews.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        rating: reviews.rating,
        serviceName: reviews.serviceName,
        source: reviews.source,
        body: reviews.body,
        staffResponse: reviews.staffResponse,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
      .leftJoin(profiles, eq(reviews.clientId, profiles.id))
      .where(
        and(
          eq(bookings.staffId, user.id),
          sql`(${reviews.status} = 'approved' OR ${reviews.isFeatured} = true)`,
        ),
      )
      .orderBy(desc(reviews.createdAt));

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Transform each DB row into an AssistantReviewRow — abbreviates client name
    // to "First L." for privacy (assistants see the abbreviated form, not full names).
    // .filter(Boolean) on initials handles missing first/last name characters.
    const reviewList: AssistantReviewRow[] = allRows.map((r) => {
      const first = r.firstName ?? "";
      const last = r.lastName ?? "";
      const name = `${first} ${last.charAt(0)}.`.trim();
      const initials = [first[0], last[0]].filter(Boolean).join("").toUpperCase() || "?";
      const d = new Date(r.createdAt);

      return {
        id: r.id,
        client: name,
        clientInitials: initials,
        rating: r.rating,
        service: r.serviceName ?? "General",
        source: r.source,
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dateKey: d.toISOString(),
        comment: r.body ?? "",
        replied: !!r.staffResponse,
        replyText: r.staffResponse,
      };
    });

    /*
     * Stats are computed in-memory from the already-fetched rows (no extra DB query).
     * This is fine because the assistant's review set is typically small (< 100).
     * Includes: total count, average rating, 5-star/4-star counts, this-month count,
     * response rate (% of reviews with a staff reply), and a star-rating distribution.
     */
    // Stats
    const total = reviewList.length;
    // .reduce() sums all ratings, then divides by count for average — ternary
    // guards against division by zero when the assistant has no reviews.
    const avg =
      total > 0 ? Math.round((reviewList.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
    // .filter() counts for each stat — separate passes are clearer than a single
    // .reduce() with multiple accumulators, and the array is small (< 100 reviews).
    const fiveStarCount = reviewList.filter((r) => r.rating === 5).length;
    const fourStarCount = reviewList.filter((r) => r.rating === 4).length;
    const repliedCount = reviewList.filter((r) => r.replied).length;
    const responseRate = total > 0 ? Math.round((repliedCount / total) * 100) : 0;
    // .filter() on the raw DB rows (not reviewList) because we need createdAt
    // as a Date, not the formatted date string in reviewList.
    const thisMonthCount = allRows.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const ratingMap = new Map<number, number>();
    for (const r of reviewList) {
      ratingMap.set(r.rating, (ratingMap.get(r.rating) ?? 0) + 1);
    }
    // .map() over fixed [5,4,3,2,1] to produce a complete distribution even for
    // star values with zero reviews — the UI chart needs all 5 buckets present.
    const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: ratingMap.get(stars) ?? 0,
    }));

    return {
      reviews: reviewList,
      stats: {
        totalReviews: total,
        avgRating: avg,
        fiveStarCount,
        fourStarCount,
        thisMonthCount,
        responseRate,
        repliedCount,
        ratingDist,
      },
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Assistant reply mutation                                           */
/* ------------------------------------------------------------------ */

/**
 * Lets an assistant save a reply to a review on one of their bookings.
 * Verifies the review belongs to one of the assistant's bookings.
 */
export async function assistantSaveReply(reviewId: number, reply: string) {
  try {
    z.number().int().positive().parse(reviewId);
    z.string().parse(reply);
    const user = await getAssistantUser();

    /*
     * Authorization check — two-step lookup to verify this assistant owns the booking.
     *
     * Step 1: SELECT reviews.booking_id WHERE reviews.id = :reviewId LIMIT 1
     *   – get the booking linked to this review.
     *
     * Step 2: SELECT bookings.staff_id WHERE bookings.id = :bookingId LIMIT 1
     *   – check that the booking's assigned staff matches the current user.
     *
     * If either lookup fails or staff_id doesn't match, throw an auth error.
     */
    // Verify this review is on one of the assistant's bookings
    const [review] = await db
      .select({ bookingId: reviews.bookingId })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review?.bookingId) throw new Error("Review not found");

    const [booking] = await db
      .select({ staffId: bookings.staffId })
      .from(bookings)
      .where(eq(bookings.id, review.bookingId))
      .limit(1);

    if (booking?.staffId !== user.id) {
      throw new Error("Not authorized to reply to this review");
    }

    /*
     * UPDATE reviews
     *   SET staff_response    = :reply (or NULL if empty),
     *       staff_responded_at = NOW() (or NULL if clearing),
     *       updated_at         = NOW()
     *   WHERE id = :reviewId
     *
     * Same logic as the admin saveReply — empty/whitespace reply clears the response.
     *
     * Side-effects: revalidatePath("/dashboard/reviews") + updateTag("booking-page").
     */
    await db
      .update(reviews)
      .set({
        staffResponse: reply.trim() || null,
        staffRespondedAt: reply.trim() ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    revalidatePath("/dashboard/reviews");
    updateTag("booking-page");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
