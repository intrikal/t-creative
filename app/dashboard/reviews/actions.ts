/**
 * Server actions for the Reviews dashboard (`/dashboard/reviews`).
 *
 * Queries the `reviews` table joined with `profiles` for client names.
 * Provides CRUD operations: fetch, approve, reject, feature, reply.
 *
 * DB status enum: pending | approved | rejected
 * UI maps: isFeatured=true → "featured", status=rejected → "hidden"
 *
 * @module reviews/actions
 * @see {@link ./ReviewsPage.tsx} — client component consuming this data
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "@/db";
import { reviews, profiles, bookings } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

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

export async function getReviews(): Promise<ReviewRow[]> {
  await getUser();

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
    .orderBy(desc(reviews.createdAt));

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
}

export async function getReviewStats(): Promise<ReviewStats> {
  await getUser();

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

  const total = Number(statsRow.total);
  const ratingMap = new Map(ratingRows.map((r) => [r.rating, Number(r.count)]));

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
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function approveReview(reviewId: number) {
  await getUser();
  await db
    .update(reviews)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(reviews.id, reviewId));
  revalidatePath("/dashboard/reviews");
}

export async function rejectReview(reviewId: number) {
  await getUser();
  await db
    .update(reviews)
    .set({ status: "rejected", isFeatured: false, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId));
  revalidatePath("/dashboard/reviews");
}

export async function featureReview(reviewId: number) {
  await getUser();
  await db
    .update(reviews)
    .set({ isFeatured: true, status: "approved", updatedAt: new Date() })
    .where(eq(reviews.id, reviewId));
  revalidatePath("/dashboard/reviews");
}

export async function unfeatureReview(reviewId: number) {
  await getUser();
  await db
    .update(reviews)
    .set({ isFeatured: false, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId));
  revalidatePath("/dashboard/reviews");
}

export async function saveReply(reviewId: number, reply: string) {
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
  const user = await getUser();

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

  // Stats
  const total = reviewList.length;
  const avg =
    total > 0 ? Math.round((reviewList.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
  const fiveStarCount = reviewList.filter((r) => r.rating === 5).length;
  const fourStarCount = reviewList.filter((r) => r.rating === 4).length;
  const repliedCount = reviewList.filter((r) => r.replied).length;
  const responseRate = total > 0 ? Math.round((repliedCount / total) * 100) : 0;
  const thisMonthCount = allRows.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const ratingMap = new Map<number, number>();
  for (const r of reviewList) {
    ratingMap.set(r.rating, (ratingMap.get(r.rating) ?? 0) + 1);
  }
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
}

/* ------------------------------------------------------------------ */
/*  Assistant reply mutation                                           */
/* ------------------------------------------------------------------ */

/**
 * Lets an assistant save a reply to a review on one of their bookings.
 * Verifies the review belongs to one of the assistant's bookings.
 */
export async function assistantSaveReply(reviewId: number, reply: string) {
  const user = await getUser();

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

  await db
    .update(reviews)
    .set({
      staffResponse: reply.trim() || null,
      staffRespondedAt: reply.trim() ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId));

  revalidatePath("/dashboard/reviews");
}
