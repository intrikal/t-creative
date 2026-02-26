/**
 * Public server actions for the /portfolio page.
 * No authentication required — reads only published media items.
 */
"use server";

import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";

export type PublicMediaItem = {
  id: number;
  type: string;
  category: string | null;
  title: string | null;
  caption: string | null;
  publicUrl: string | null;
  isFeatured: boolean;
};

export async function getPublishedMedia(): Promise<PublicMediaItem[]> {
  return db
    .select({
      id: mediaItems.id,
      type: mediaItems.type,
      category: mediaItems.category,
      title: mediaItems.title,
      caption: mediaItems.caption,
      publicUrl: mediaItems.publicUrl,
      isFeatured: mediaItems.isFeatured,
    })
    .from(mediaItems)
    .where(eq(mediaItems.isPublished, true))
    .orderBy(asc(mediaItems.sortOrder));
}
