/**
 * app/dashboard/gallery/actions.ts — Server actions for the client Gallery page.
 *
 * Returns two lists for the logged-in client:
 *   1. "Portfolio" — all published media items (the public lookbook everyone sees).
 *   2. "My Photos" — every media item tagged to this specific client, including
 *      unpublished ones awaiting consent.
 *
 * Also provides a consent action so the client can approve a before/after photo
 * for public display.
 *
 * @module dashboard/gallery/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, and, desc, asc, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GalleryCategory = "lash" | "jewelry" | "crochet" | "consulting";
export type MediaType = "image" | "video" | "before_after";

export type GalleryItem = {
  id: number;
  type: MediaType;
  category: GalleryCategory;
  title: string;
  caption: string;
  imageUrl: string | null;
  beforeImageUrl: string | null;
  isFeatured: boolean;
  clientConsentGiven: boolean;
};

export type ClientGalleryData = {
  portfolio: GalleryItem[];
  myPhotos: GalleryItem[];
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientGallery(): Promise<ClientGalleryData> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    const cols = {
      id: mediaItems.id,
      type: mediaItems.type,
      category: mediaItems.category,
      title: mediaItems.title,
      caption: mediaItems.caption,
      publicUrl: mediaItems.publicUrl,
      beforeStoragePath: mediaItems.beforeStoragePath,
      isFeatured: mediaItems.isFeatured,
      clientConsentGiven: mediaItems.clientConsentGiven,
    } as const;

    // ── Query 1: Published portfolio ────────────────────────────────────
    // SELECT  id, type, category, title, caption, publicUrl,
    //         beforeStoragePath, isFeatured, clientConsentGiven
    // FROM    media_items
    // WHERE   isPublished = true              ← only publicly visible items
    // ORDER BY sortOrder ASC, createdAt DESC  ← manual sort order first, then newest
    //
    // No JOINs — all data is in media_items.
    // 1. Published portfolio items (the public lookbook)
    const portfolioRows = await db
      .select(cols)
      .from(mediaItems)
      .where(eq(mediaItems.isPublished, true))
      .orderBy(asc(mediaItems.sortOrder), desc(mediaItems.createdAt));

    // ── Query 2: This client's photos ───────────────────────────────────
    // SELECT  (same columns as above)
    // FROM    media_items
    // WHERE   clientId = <current user>       ← photos linked to this specific client
    // ORDER BY createdAt DESC                 ← newest first
    //
    // Includes unpublished items so the client can see photos pending their consent.
    // 2. Photos tagged to this client — all of them, including pending consent
    const myPhotoRows = await db
      .select(cols)
      .from(mediaItems)
      .where(eq(mediaItems.clientId, user.id))
      .orderBy(desc(mediaItems.createdAt));

    function getBeforeUrl(beforeStoragePath: string | null): string | null {
      if (!beforeStoragePath) return null;
      return supabase.storage.from("media").getPublicUrl(beforeStoragePath).data.publicUrl;
    }

    function mapRow(r: (typeof portfolioRows)[number]): GalleryItem {
      return {
        id: r.id,
        type: (r.type as MediaType) ?? "image",
        category: (r.category as GalleryCategory) ?? "lash",
        title: r.title ?? "",
        caption: r.caption ?? "",
        imageUrl: r.publicUrl ?? null,
        beforeImageUrl: getBeforeUrl(r.beforeStoragePath ?? null),
        isFeatured: r.isFeatured,
        clientConsentGiven: r.clientConsentGiven,
      };
    }

    return {
      portfolio: portfolioRows.map(mapRow),
      myPhotos: myPhotoRows.map(mapRow),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client consent                                                     */
/* ------------------------------------------------------------------ */

/**
 * Approves a before/after photo for public portfolio display.
 * Sets clientConsentGiven = true and publishes the item.
 * Only works on media items tagged to the logged-in client.
 *
 * UPDATE media_items
 * SET    clientConsentGiven = true,
 *        isPublished = true,            ← auto-publish upon consent
 *        updatedAt = now()
 * WHERE  id = <mediaItemId>
 *   AND  clientId = <current user>      ← security: only the tagged client can consent
 */
export async function grantPhotoConsent(mediaItemId: number): Promise<void> {
  try {
    z.number().int().positive().parse(mediaItemId);

    const user = await getUser();

    await db
      .update(mediaItems)
      .set({ clientConsentGiven: true, isPublished: true, updatedAt: new Date() })
      .where(and(eq(mediaItems.id, mediaItemId), eq(mediaItems.clientId, user.id)));

    revalidatePath("/dashboard/gallery");
    revalidatePath("/dashboard/media");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
