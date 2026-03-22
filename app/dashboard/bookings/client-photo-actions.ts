"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { clientPhotos, bookings, services } from "@/db/schema";
import { getUser, requireStaff } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ClientPhoto = {
  id: number;
  bookingId: number;
  photoType: "before" | "after" | "reference";
  url: string;
  notes: string | null;
  createdAt: string;
};

export type BookingPhotoGroup = {
  bookingId: number;
  serviceName: string;
  bookingDate: string;
  photos: ClientPhoto[];
};

/* ------------------------------------------------------------------ */
/*  Staff: get photos for a specific booking                           */
/* ------------------------------------------------------------------ */

export async function getBookingPhotos(bookingId: number): Promise<ClientPhoto[]> {
  try {
    await requireStaff();
    const supabase = await createClient();

    const rows = await db
      .select({
        id: clientPhotos.id,
        bookingId: clientPhotos.bookingId,
        photoType: clientPhotos.photoType,
        storagePath: clientPhotos.storagePath,
        notes: clientPhotos.notes,
        createdAt: clientPhotos.createdAt,
      })
      .from(clientPhotos)
      .where(eq(clientPhotos.bookingId, bookingId))
      .orderBy(desc(clientPhotos.createdAt));

    return Promise.all(
      rows.map(async (r) => {
        const { data } = await supabase.storage
          .from("client-photos")
          .createSignedUrl(r.storagePath, 3600);
        return {
          id: r.id,
          bookingId: r.bookingId,
          photoType: r.photoType as ClientPhoto["photoType"],
          url: data?.signedUrl ?? "",
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    );
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Staff: delete a photo                                              */
/* ------------------------------------------------------------------ */

export async function deleteClientPhoto(photoId: number): Promise<void> {
  try {
    await requireStaff();
    const supabase = await createClient();

    const [photo] = await db
      .select({ storagePath: clientPhotos.storagePath })
      .from(clientPhotos)
      .where(eq(clientPhotos.id, photoId))
      .limit(1);

    if (!photo) return;

    await supabase.storage.from("client-photos").remove([photo.storagePath]);
    await db.delete(clientPhotos).where(eq(clientPhotos.id, photoId));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client: get own photos grouped by booking                          */
/* ------------------------------------------------------------------ */

export async function getMyPhotos(): Promise<BookingPhotoGroup[]> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    const rows = await db
      .select({
        id: clientPhotos.id,
        bookingId: clientPhotos.bookingId,
        photoType: clientPhotos.photoType,
        storagePath: clientPhotos.storagePath,
        notes: clientPhotos.notes,
        createdAt: clientPhotos.createdAt,
        serviceName: services.name,
        bookingDate: bookings.startsAt,
      })
      .from(clientPhotos)
      .innerJoin(bookings, eq(clientPhotos.bookingId, bookings.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(eq(clientPhotos.profileId, user.id))
      .orderBy(desc(bookings.startsAt), desc(clientPhotos.createdAt));

    // Group by booking
    const grouped = new Map<number, BookingPhotoGroup>();

    for (const r of rows) {
      const { data } = await supabase.storage
        .from("client-photos")
        .createSignedUrl(r.storagePath, 3600);

      const photo: ClientPhoto = {
        id: r.id,
        bookingId: r.bookingId,
        photoType: r.photoType as ClientPhoto["photoType"],
        url: data?.signedUrl ?? "",
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      };

      if (!grouped.has(r.bookingId)) {
        grouped.set(r.bookingId, {
          bookingId: r.bookingId,
          serviceName: r.serviceName ?? "Service",
          bookingDate: r.bookingDate.toISOString(),
          photos: [],
        });
      }
      grouped.get(r.bookingId)!.photos.push(photo);
    }

    return Array.from(grouped.values());
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}
