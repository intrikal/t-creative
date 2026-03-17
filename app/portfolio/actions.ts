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
  beforePublicUrl: string | null;
  isFeatured: boolean;
};

export async function getPublishedMedia(): Promise<PublicMediaItem[]> {
  const rows = await db
    .select({
      id: mediaItems.id,
      type: mediaItems.type,
      category: mediaItems.category,
      title: mediaItems.title,
      caption: mediaItems.caption,
      publicUrl: mediaItems.publicUrl,
      beforeStoragePath: mediaItems.beforeStoragePath,
      isFeatured: mediaItems.isFeatured,
    })
    .from(mediaItems)
    .where(eq(mediaItems.isPublished, true))
    .orderBy(asc(mediaItems.sortOrder));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    caption: row.caption,
    publicUrl: row.publicUrl,
    beforePublicUrl:
      row.beforeStoragePath && supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/media/${row.beforeStoragePath}`
        : null,
    isFeatured: row.isFeatured,
  }));
}
