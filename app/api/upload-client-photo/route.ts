/**
 * POST /api/upload-client-photo — Upload a client photo to Supabase Storage.
 *
 * Auth required (admin or assistant). Validates file type and size, uploads
 * to the `client-photos` bucket at path {profileId}/{bookingId}/{filename},
 * and inserts a `client_photos` row.
 *
 * Body: multipart/form-data with fields:
 *   file       — image file (JPEG, PNG, WEBP, HEIC, HEIF, max 10 MB)
 *   bookingId  — booking ID (string-encoded number)
 *   profileId  — client's profile UUID
 *   photoType  — "before" | "after" | "reference"
 *   notes      — optional text
 *
 * Returns: { id: number, url: string }
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, clientPhotos } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "client-photos";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const metaSchema = z.object({
  bookingId: z.string().regex(/^\d+$/).transform(Number),
  profileId: z.string().uuid(),
  photoType: z.enum(["before", "after", "reference"]),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaff();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const meta = metaSchema.safeParse({
    bookingId: formData.get("bookingId"),
    profileId: formData.get("profileId"),
    photoType: formData.get("photoType"),
    notes: formData.get("notes") || undefined,
  });

  if (!meta.success) {
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
  }

  const { bookingId, profileId, photoType, notes } = meta.data;

  // Verify the booking exists and belongs to this client
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(eq(bookings.id, bookingId), eq(bookings.clientId, profileId), isNull(bookings.deletedAt)),
    )
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);
  const storagePath = `${profileId}/${bookingId}/${Date.now()}-${safeName}.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    Sentry.captureException(uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  try {
    const [row] = await db
      .insert(clientPhotos)
      .values({
        bookingId,
        profileId,
        uploadedBy: user.id,
        photoType,
        storagePath,
        notes: notes ?? null,
      })
      .returning({ id: clientPhotos.id });

    // Generate a signed URL for the uploaded photo
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);

    return NextResponse.json({ id: row.id, url: data?.signedUrl ?? "" });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save photo record" }, { status: 500 });
  }
}
