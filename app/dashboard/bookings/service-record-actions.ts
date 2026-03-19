/**
 * app/dashboard/bookings/service-record-actions.ts — Service record (post-appointment notes) actions.
 *
 * Manages service records attached to bookings: fetch, upsert, upload photos,
 * and promote before/after photos to the portfolio gallery.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { MediaCategory } from "@/app/dashboard/media/actions";
import { db } from "@/db";
import { profiles, serviceRecords, mediaItems, notifications } from "@/db/schema";
import { trackEvent } from "@/lib/posthog";
import { getUser } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

export type ServiceRecordRow = {
  id: number;
  bookingId: number;
  clientId: string;
  staffId: string | null;
  staffName: string | null;
  lashMapping: string | null;
  curlType: string | null;
  diameter: string | null;
  lengths: string | null;
  adhesive: string | null;
  retentionNotes: string | null;
  productsUsed: string | null;
  notes: string | null;
  reactions: string | null;
  nextVisitNotes: string | null;
  beforePhotoPath: string | null;
  afterPhotoPath: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  createdAt: string;
};

export type ServiceRecordInput = {
  bookingId: number;
  clientId: string;
  lashMapping?: string;
  curlType?: string;
  diameter?: string;
  lengths?: string;
  adhesive?: string;
  retentionNotes?: string;
  productsUsed?: string;
  notes?: string;
  reactions?: string;
  nextVisitNotes?: string;
  beforePhotoPath?: string;
  afterPhotoPath?: string;
};

export async function getServiceRecord(bookingId: number): Promise<ServiceRecordRow | null> {
  try {
    await getUser();
    const supabase = await createClient();

    const staffProfile = alias(profiles, "recordStaff");

    const rows = await db
      .select({
        id: serviceRecords.id,
        bookingId: serviceRecords.bookingId,
        clientId: serviceRecords.clientId,
        staffId: serviceRecords.staffId,
        staffName: staffProfile.firstName,
        lashMapping: serviceRecords.lashMapping,
        curlType: serviceRecords.curlType,
        diameter: serviceRecords.diameter,
        lengths: serviceRecords.lengths,
        adhesive: serviceRecords.adhesive,
        retentionNotes: serviceRecords.retentionNotes,
        productsUsed: serviceRecords.productsUsed,
        notes: serviceRecords.notes,
        reactions: serviceRecords.reactions,
        nextVisitNotes: serviceRecords.nextVisitNotes,
        beforePhotoPath: serviceRecords.beforePhotoPath,
        afterPhotoPath: serviceRecords.afterPhotoPath,
        createdAt: serviceRecords.createdAt,
      })
      .from(serviceRecords)
      .leftJoin(staffProfile, eq(serviceRecords.staffId, staffProfile.id))
      .where(eq(serviceRecords.bookingId, bookingId))
      .limit(1);

    if (rows.length === 0) return null;

    const r = rows[0];
    const getUrl = (path: string | null) =>
      path ? supabase.storage.from("media").getPublicUrl(path).data.publicUrl : null;

    return {
      ...r,
      beforePhotoUrl: getUrl(r.beforePhotoPath),
      afterPhotoUrl: getUrl(r.afterPhotoPath),
      createdAt: r.createdAt.toISOString(),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const serviceRecordInputSchema = z.object({
  bookingId: z.number().int().positive(),
  clientId: z.string().min(1),
  lashMapping: z.string().optional(),
  curlType: z.string().optional(),
  diameter: z.string().optional(),
  lengths: z.string().optional(),
  adhesive: z.string().optional(),
  retentionNotes: z.string().optional(),
  productsUsed: z.string().optional(),
  notes: z.string().optional(),
  reactions: z.string().optional(),
  nextVisitNotes: z.string().optional(),
  beforePhotoPath: z.string().optional(),
  afterPhotoPath: z.string().optional(),
});

export async function upsertServiceRecord(input: ServiceRecordInput): Promise<void> {
  try {
    serviceRecordInputSchema.parse(input);
    const user = await getUser();

    // Check if a record already exists for this booking
    const existing = await db
      .select({ id: serviceRecords.id })
      .from(serviceRecords)
      .where(eq(serviceRecords.bookingId, input.bookingId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(serviceRecords)
        .set({
          lashMapping: input.lashMapping ?? null,
          curlType: input.curlType ?? null,
          diameter: input.diameter ?? null,
          lengths: input.lengths ?? null,
          adhesive: input.adhesive ?? null,
          retentionNotes: input.retentionNotes ?? null,
          productsUsed: input.productsUsed ?? null,
          notes: input.notes ?? null,
          reactions: input.reactions ?? null,
          nextVisitNotes: input.nextVisitNotes ?? null,
          ...(input.beforePhotoPath !== undefined
            ? { beforePhotoPath: input.beforePhotoPath }
            : {}),
          ...(input.afterPhotoPath !== undefined ? { afterPhotoPath: input.afterPhotoPath } : {}),
        })
        .where(eq(serviceRecords.id, existing[0].id));
    } else {
      await db.insert(serviceRecords).values({
        bookingId: input.bookingId,
        clientId: input.clientId,
        staffId: user.id,
        lashMapping: input.lashMapping ?? null,
        curlType: input.curlType ?? null,
        diameter: input.diameter ?? null,
        lengths: input.lengths ?? null,
        adhesive: input.adhesive ?? null,
        retentionNotes: input.retentionNotes ?? null,
        productsUsed: input.productsUsed ?? null,
        notes: input.notes ?? null,
        reactions: input.reactions ?? null,
        nextVisitNotes: input.nextVisitNotes ?? null,
        beforePhotoPath: input.beforePhotoPath ?? null,
        afterPhotoPath: input.afterPhotoPath ?? null,
      });
    }

    trackEvent(user.id, "service_record_saved", {
      bookingId: input.bookingId,
      clientId: input.clientId,
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Uploads a single before or after photo to Supabase Storage and returns
 * the storage path + public URL. Called from the service record dialog
 * immediately on file selection so the tech sees a preview before saving.
 */
export async function uploadServicePhoto(
  formData: FormData,
): Promise<{ path: string; publicUrl: string }> {
  try {
    await getUser();
    const supabase = await createClient();

    const file = formData.get("file") as File | null;
    const bookingId = formData.get("bookingId") as string | null;
    const slot = (formData.get("slot") as string) ?? "photo";

    if (!file) throw new Error("No file provided");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const timestamp = Date.now();
    const path = `service-records/${bookingId ?? "unknown"}/${slot}-${timestamp}.${ext}`;

    const { error } = await supabase.storage.from("media").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(path);
    return { path, publicUrl };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Creates a media_items row from a service record's before/after photos
 * and queues a consent notification for the client.
 * The item is unpublished until the client approves.
 */
const promoteToPortfolioSchema = z.object({
  bookingId: z.number().int().positive(),
  category: z.enum(["lash", "jewelry", "crochet", "consulting"]),
  caption: z.string().optional(),
});

export async function promoteToPortfolio(input: {
  bookingId: number;
  category: MediaCategory;
  caption?: string;
}): Promise<void> {
  try {
    promoteToPortfolioSchema.parse(input);
    await getUser();
    const supabase = await createClient();

    const [record] = await db
      .select({
        clientId: serviceRecords.clientId,
        beforePhotoPath: serviceRecords.beforePhotoPath,
        afterPhotoPath: serviceRecords.afterPhotoPath,
      })
      .from(serviceRecords)
      .where(eq(serviceRecords.bookingId, input.bookingId))
      .limit(1);

    if (!record) throw new Error("Service record not found");
    if (!record.beforePhotoPath || !record.afterPhotoPath) {
      throw new Error("Both before and after photos are required");
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(record.afterPhotoPath);

    const [inserted] = await db
      .insert(mediaItems)
      .values({
        type: "before_after",
        category: input.category,
        clientId: record.clientId,
        caption: input.caption?.trim() || null,
        storagePath: record.afterPhotoPath,
        beforeStoragePath: record.beforePhotoPath,
        publicUrl,
        clientConsentGiven: false,
        isPublished: false,
      })
      .returning({ id: mediaItems.id });

    // Notify the client so they see the pending approval in their gallery
    await db.insert(notifications).values({
      profileId: record.clientId,
      type: "general",
      channel: "internal",
      status: "sent",
      title: "Your photos are ready for the portfolio",
      body: "T Creative would like to feature your before & after photos in the portfolio. Open your gallery to approve.",
      relatedEntityType: "media_item",
      relatedEntityId: inserted.id,
      sentAt: new Date(),
    });

    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/gallery");
    revalidatePath("/dashboard/media");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
