"use server";

import { eq, and, desc, asc } from "drizzle-orm";
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

  // 1. Published portfolio items (the public lookbook)
  const portfolioRows = await db
    .select({
      id: mediaItems.id,
      type: mediaItems.type,
      category: mediaItems.category,
      title: mediaItems.title,
      caption: mediaItems.caption,
      publicUrl: mediaItems.publicUrl,
      storagePath: mediaItems.storagePath,
      beforeStoragePath: mediaItems.beforeStoragePath,
      isFeatured: mediaItems.isFeatured,
    })
    .from(mediaItems)
    .where(eq(mediaItems.isPublished, true))
    .orderBy(asc(mediaItems.sortOrder), desc(mediaItems.createdAt));

  // 2. Photos tagged to this client (my session photos)
  const myPhotoRows = await db
    .select({
      id: mediaItems.id,
      type: mediaItems.type,
      category: mediaItems.category,
      title: mediaItems.title,
      caption: mediaItems.caption,
      publicUrl: mediaItems.publicUrl,
      storagePath: mediaItems.storagePath,
      beforeStoragePath: mediaItems.beforeStoragePath,
      isFeatured: mediaItems.isFeatured,
    })
    .from(mediaItems)
    .where(eq(mediaItems.clientId, user.id))
    .orderBy(desc(mediaItems.createdAt));

  function mapRow(r: (typeof portfolioRows)[number]): GalleryItem {
    return {
      id: r.id,
      type: (r.type as MediaType) ?? "image",
      category: (r.category as GalleryCategory) ?? "lash",
      title: r.title ?? "",
      caption: r.caption ?? "",
      imageUrl: r.publicUrl ?? null,
      beforeImageUrl: r.beforeStoragePath ? r.publicUrl : null,
      isFeatured: r.isFeatured,
    };
  }

  return {
    portfolio: portfolioRows.map(mapRow),
    myPhotos: myPhotoRows.map(mapRow),
  };
}
