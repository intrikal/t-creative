/**
 * Server actions for the Media dashboard (`/dashboard/media`).
 *
 * Handles CRUD for media_items + Supabase Storage uploads.
 * The storage bucket "media" must be created in Supabase Studio
 * (Storage → New Bucket → name: "media", public: true).
 *
 * @module media/actions
 * @see {@link ./MediaPage.tsx} — client component consuming this data
 */
"use server";

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mediaItems, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { MediaCategory, MediaRow, MediaStats } from "@/lib/types/media.types";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "media";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type { MediaCategory, MediaRow, MediaStats } from "@/lib/types/media.types";

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetches every media item in the system for the admin media library.
 *
 * SELECT  media_items.*, profiles.firstName, profiles.lastName
 * FROM    media_items
 * LEFT JOIN profiles ON media_items.clientId = profiles.id
 *   → pulls the client's name so the admin can see who each photo belongs to.
 *   → LEFT JOIN because some media items have no client (e.g. studio shots).
 * ORDER BY media_items.createdAt DESC   ← newest uploads first
 */
export async function getMediaItems(): Promise<MediaRow[]> {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        id: mediaItems.id,
        type: mediaItems.type,
        category: mediaItems.category,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        title: mediaItems.title,
        caption: mediaItems.caption,
        publicUrl: mediaItems.publicUrl,
        storagePath: mediaItems.storagePath,
        fileSizeBytes: mediaItems.fileSizeBytes,
        isPublished: mediaItems.isPublished,
        isFeatured: mediaItems.isFeatured,
        createdAt: mediaItems.createdAt,
      })
      .from(mediaItems)
      .leftJoin(profiles, eq(mediaItems.clientId, profiles.id))
      .orderBy(desc(mediaItems.createdAt));

    return rows.map((r) => {
      const first = r.firstName ?? "";
      const last = r.lastName ?? "";
      const name = [first, last].filter(Boolean).join(" ") || null;

      return {
        id: r.id,
        type: r.type as MediaRow["type"],
        category: r.category as MediaCategory | null,
        client: name,
        title: r.title,
        caption: r.caption,
        publicUrl: r.publicUrl,
        storagePath: r.storagePath,
        fileSizeBytes: r.fileSizeBytes,
        isPublished: r.isPublished,
        isFeatured: r.isFeatured,
        date: new Date(r.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Computes aggregate statistics across all media items in a single query.
 *
 * SELECT
 *   count(*)                                        → total number of media items
 *   count(*) FILTER (WHERE isPublished = true)      → how many are publicly visible
 *   count(*) FILTER (WHERE isFeatured = true)       → how many are marked as featured
 *   coalesce(sum(fileSizeBytes), 0)                 → total storage used in bytes
 * FROM media_items
 *
 * No JOINs — all data lives in the media_items table.
 * No WHERE clause — counts everything regardless of category or client.
 */
export async function getMediaStats(): Promise<MediaStats> {
  try {
    await requireAdmin();

    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        published: sql<number>`count(*) filter (where ${mediaItems.isPublished} = true)`,
        featured: sql<number>`count(*) filter (where ${mediaItems.isFeatured} = true)`,
        totalSize: sql<number>`coalesce(sum(${mediaItems.fileSizeBytes}), 0)`,
      })
      .from(mediaItems);

    return {
      total: Number(row.total),
      published: Number(row.published),
      featured: Number(row.featured),
      totalSizeBytes: Number(row.totalSize),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Upload                                                             */
/* ------------------------------------------------------------------ */

export async function uploadMedia(formData: FormData) {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const files = formData.getAll("files") as File[];
    const caption = formData.get("caption") as string | null;
    const category = formData.get("category") as MediaCategory | null;
    const featured = formData.get("featured") === "true";

    if (files.length === 0) throw new Error("No files provided");

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const timestamp = Date.now();
      const safeName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 60);
      const path = `portfolio/${category ?? "general"}/${timestamp}-${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);

      await db.insert(mediaItems).values({
        type: "image",
        category: category ?? null,
        caption: caption?.trim() || null,
        storagePath: path,
        publicUrl,
        fileSizeBytes: file.size,
        isPublished: featured,
        isFeatured: featured,
      });
    }

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/media");
    updateTag("portfolio");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Toggles a media item's published state.
 *
 * UPDATE media_items
 * SET    isPublished = <publish>, updatedAt = now()
 *        -- if unpublishing, also SET isFeatured = false (can't feature an unpublished item)
 * WHERE  id = <id>
 */
export async function togglePublish(id: number, publish: boolean) {
  try {
    z.number().int().positive().parse(id);
    z.boolean().parse(publish);
    await requireAdmin();
    await db
      .update(mediaItems)
      .set({
        isPublished: publish,
        // Un-feature if unpublishing
        ...(publish ? {} : { isFeatured: false }),
        updatedAt: new Date(),
      })
      .where(eq(mediaItems.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/media");
    updateTag("portfolio");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Toggles a media item's featured state.
 *
 * UPDATE media_items
 * SET    isFeatured = <feature>, updatedAt = now()
 *        -- if featuring, also SET isPublished = true (featured implies published)
 * WHERE  id = <id>
 */
export async function toggleFeatured(id: number, feature: boolean) {
  try {
    z.number().int().positive().parse(id);
    z.boolean().parse(feature);
    await requireAdmin();
    await db
      .update(mediaItems)
      .set({
        isFeatured: feature,
        // Auto-publish if featuring
        ...(feature ? { isPublished: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mediaItems.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/media");
    updateTag("portfolio");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const updateMediaItemSchema = z.object({
  caption: z.string().optional(),
  title: z.string().optional(),
  category: z.enum(["lash", "jewelry", "crochet", "consulting"]).nullable().optional(),
});

/**
 * Partially updates a media item's caption, title, and/or category.
 *
 * UPDATE media_items
 * SET    caption = ?, title = ?, category = ?, updatedAt = now()
 *        (only the fields provided in `data` are included in the SET clause)
 * WHERE  id = <id>
 */
export async function updateMediaItem(
  id: number,
  data: { caption?: string; title?: string; category?: MediaCategory | null },
) {
  try {
    z.number().int().positive().parse(id);
    updateMediaItemSchema.parse(data);
    await requireAdmin();
    await db
      .update(mediaItems)
      .set({
        ...(data.caption !== undefined ? { caption: data.caption.trim() || null } : {}),
        ...(data.title !== undefined ? { title: data.title.trim() || null } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        updatedAt: new Date(),
      })
      .where(eq(mediaItems.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/media");
    updateTag("portfolio");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Deletes a media item from both the database and Supabase Storage.
 *
 * Step 1 — Look up the storage path:
 *   SELECT storagePath FROM media_items WHERE id = <id>
 *
 * Step 2 — Remove the file from the "media" Supabase Storage bucket.
 *
 * Step 3 — Delete the database row:
 *   DELETE FROM media_items WHERE id = <id>
 */
export async function deleteMediaItem(id: number) {
  try {
    z.number().int().positive().parse(id);
    await requireAdmin();
    const supabase = await createClient();

    // Get storage path before deleting
    const [item] = await db
      .select({ storagePath: mediaItems.storagePath })
      .from(mediaItems)
      .where(eq(mediaItems.id, id));

    if (item) {
      // Delete from Storage
      await supabase.storage.from(BUCKET).remove([item.storagePath]);
      // Delete DB row
      await db.delete(mediaItems).where(eq(mediaItems.id, id));
    }

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/media");
    updateTag("portfolio");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
