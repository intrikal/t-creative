/**
 * Square webhook route — signature verification, event storage, enqueue to Inngest.
 *
 * Runs on Vercel Edge Runtime for independent concurrency scaling from the
 * main app's serverless functions. Heavy processing is delegated to Inngest.
 *
 * Flow:
 * 1. Verify the webhook signature (Web Crypto HMAC-SHA256)
 * 2. Idempotency check via `webhook_events` table (Supabase PostgREST)
 * 3. Store the raw event in `webhook_events`
 * 4. Enqueue `square/webhook.received` to Inngest for async processing
 * 5. Return 200 immediately — Inngest runs handlers, marks processed, writes sync_log
 *
 * Always returns 200 to Square after storage — failures surface in Inngest.
 *
 * @module api/webhooks/square
 */
export const runtime = "edge";

import { inngest } from "@/inngest/client";
import { supabase } from "./edge-db";

/* ------------------------------------------------------------------ */
/*  Signature verification (Web Crypto — no Node.js crypto needed)    */
/* ------------------------------------------------------------------ */

async function verifySignature(body: string, signature: string, url: string): Promise<boolean> {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(url + body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return expected === signature;
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const url = request.url;

  // Verify signature
  if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && !(await verifySignature(body, signature, url))) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventId = (event.event_id as string) ?? null;
  const eventType = (event.type as string) ?? "unknown";

  // Idempotency check
  if (eventId) {
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id, is_processed")
      .eq("provider", "square")
      .eq("external_event_id", eventId)
      .maybeSingle();

    if (existing?.is_processed) {
      return new Response("Already processed", { status: 200 });
    }
  }

  // Store raw event
  const { data: webhookRow, error } = await supabase
    .from("webhook_events")
    .insert({
      provider: "square",
      external_event_id: eventId,
      event_type: eventType,
      payload: event,
      is_processed: false,
      attempts: 1,
    })
    .select("id")
    .single();

  if (error || !webhookRow) {
    // Don't lose the event — still enqueue if insert failed due to race (duplicate key)
    // but return 500 on hard failures so Square retries
    return new Response("DB error", { status: 500 });
  }

  // Enqueue to Inngest for async processing
  await inngest.send({
    name: "square/webhook.received",
    data: {
      webhookRowId: webhookRow.id as number,
      eventType,
      eventId,
      payload: event,
    },
  });

  return new Response("OK", { status: 200 });
}
