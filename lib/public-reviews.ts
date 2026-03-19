/**
 * public-reviews — Fetch featured reviews for the public landing page.
 *
 * No auth required. Queries the reviews table directly for featured,
 * approved reviews joined with profiles for client names.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews, profiles } from "@/db/schema";

export interface FeaturedReview {
  id: number;
  client: string;
  initials: string;
  rating: number;
  serviceName: string | null;
  body: string | null;
  staffResponse: string | null;
  createdAt: string;
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

    return rows.map((r) => {
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
    });
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}
