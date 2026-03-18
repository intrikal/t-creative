/**
 * POST /api/book/upload-reference — Upload a reference/inspo photo from the public booking page.
 *
 * No auth required — called by both authenticated clients and guests.
 * Uses the Supabase service role key to bypass RLS so anyone can upload.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (get it from Supabase → Project Settings → API).
 *
 * Accepts: multipart/form-data with a single `file` field.
 * Returns: { url: string } — public CDN URL of the uploaded photo.
 *
 * Limits: images only, max 8 MB, max filename length enforced.
 */
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "media";
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);
  const path = `booking-references/${Date.now()}-${safeName}.${ext}`;

  let supabase: SupabaseClient;
  try {
    supabase = getAdminClient();
  } catch {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    Sentry.captureException(uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
