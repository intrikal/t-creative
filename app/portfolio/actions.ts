/**
 * app/portfolio/actions.ts — Public cached queries for the /portfolio page.
 *
 * Fetches all published media items for the public-facing portfolio/lookbook.
 * No authentication required. Results are cached with a "portfolio" tag and
 * revalidated when media is published/unpublished from the admin dashboard.
 *
 * @module portfolio/actions
 */
import { cacheTag, cacheLife } from "next/cache";
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

/**
 * Returns all published media items for the public portfolio page.
 *
 * SELECT  id, type, category, title, caption, publicUrl, beforeStoragePath, isFeatured
 * FROM    media_items
 * WHERE   isPublished = true        ← only items the admin has marked as visible
 * ORDER BY sortOrder ASC            ← admin-defined display order
 *
 * No JOINs — all data lives in media_items.
 *
 * For before/after items, the "before" image URL is constructed from the
 * Supabase Storage base URL + beforeStoragePath.
 */
export async function getPublishedMedia(): Promise<PublicMediaItem[]> {
  "use cache";
  cacheTag("portfolio");
  cacheLife("hours");

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
