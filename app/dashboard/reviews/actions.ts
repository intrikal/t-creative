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
import { reviews, profiles } from "@/db/schema";
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
