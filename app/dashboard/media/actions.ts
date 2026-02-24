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

import { revalidatePath } from "next/cache";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems, profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "media";

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

export type MediaCategory = "lash" | "jewelry" | "crochet" | "consulting";

export type MediaRow = {
  id: number;
  type: "image" | "video" | "before_after";
  category: MediaCategory | null;
  client: string | null;
  title: string | null;
  caption: string | null;
  publicUrl: string | null;
  storagePath: string;
  fileSizeBytes: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  date: string;
};

export type MediaStats = {
  total: number;
  published: number;
  featured: number;
  totalSizeBytes: number;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getMediaItems(): Promise<MediaRow[]> {
  await getUser();

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
}

export async function getMediaStats(): Promise<MediaStats> {
  await getUser();

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
}

/* ------------------------------------------------------------------ */
/*  Upload                                                             */
/* ------------------------------------------------------------------ */

export async function uploadMedia(formData: FormData) {
  await getUser();
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

  revalidatePath("/dashboard/media");
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function togglePublish(id: number, publish: boolean) {
  await getUser();
  await db
    .update(mediaItems)
    .set({
      isPublished: publish,
      // Un-feature if unpublishing
      ...(publish ? {} : { isFeatured: false }),
      updatedAt: new Date(),
    })
    .where(eq(mediaItems.id, id));
  revalidatePath("/dashboard/media");
}

export async function toggleFeatured(id: number, feature: boolean) {
  await getUser();
  await db
    .update(mediaItems)
    .set({
      isFeatured: feature,
      // Auto-publish if featuring
      ...(feature ? { isPublished: true } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mediaItems.id, id));
  revalidatePath("/dashboard/media");
}

export async function updateMediaItem(
  id: number,
  data: { caption?: string; title?: string; category?: MediaCategory | null },
) {
  await getUser();
  await db
    .update(mediaItems)
    .set({
      ...(data.caption !== undefined ? { caption: data.caption.trim() || null } : {}),
      ...(data.title !== undefined ? { title: data.title.trim() || null } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mediaItems.id, id));
  revalidatePath("/dashboard/media");
}

export async function deleteMediaItem(id: number) {
  await getUser();
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

  revalidatePath("/dashboard/media");
}
