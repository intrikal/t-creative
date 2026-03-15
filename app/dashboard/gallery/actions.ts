"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc, asc, or } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
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

  // 1. Published portfolio items (the public lookbook)
  const portfolioRows = await db
    .select(cols)
    .from(mediaItems)
    .where(eq(mediaItems.isPublished, true))
    .orderBy(asc(mediaItems.sortOrder), desc(mediaItems.createdAt));

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
}

/* ------------------------------------------------------------------ */
/*  Client consent                                                     */
/* ------------------------------------------------------------------ */

/**
 * Approves a before/after photo for public portfolio display.
 * Sets clientConsentGiven = true and publishes the item.
 * Only works on media items tagged to the logged-in client.
 */
export async function grantPhotoConsent(mediaItemId: number): Promise<void> {
  const user = await getUser();

  await db
    .update(mediaItems)
    .set({ clientConsentGiven: true, isPublished: true, updatedAt: new Date() })
    .where(and(eq(mediaItems.id, mediaItemId), eq(mediaItems.clientId, user.id)));

  revalidatePath("/dashboard/gallery");
  revalidatePath("/dashboard/media");
}
