/**
 * Twilio inbound SMS webhook — handles booking confirmations and cancellations.
 *
 * Clients reply to reminder SMS messages with:
 *   'C' or 'CONFIRM' → confirm their next upcoming booking
 *   'X' or 'CANCEL'  → cancel their next upcoming booking
 *
 * Flow:
 * 1. Validate the Twilio request signature (HMAC-SHA1 via x-twilio-signature)
 * 2. Store the raw event in `webhook_events` for audit/replay
 * 3. Match the sender's phone number to a client profile
 * 4. Find their next upcoming pending/confirmed booking
 * 5. Update the booking status + stamp lifecycle timestamp
 * 6. Reply with a TwiML <Message> (confirmation, cancellation, or error)
 *
 * Always returns 200 with TwiML — Twilio expects a valid XML response.
 * Unrecognized commands get a help reply; unknown phone numbers get a
 * "contact us" reply. Processing failures are logged to `sync_log`.
 *
 * ── Twilio Console Setup ──────────────────────────────────────────────
 *
 * 1. Go to https://console.twilio.com
 * 2. Navigate to: Phone Numbers → Manage → Active Numbers
 * 3. Click your SMS-enabled number (the one in TWILIO_FROM_NUMBER)
 * 4. Scroll to the "Messaging" section
 * 5. Under "A message comes in":
 *    - Set to: Webhook
 *    - URL:    https://tcreative.studio/api/webhooks/twilio
 *    - Method: HTTP POST
 * 6. Click "Save configuration"
 *
 * For local development, use ngrok to expose your local server:
 *    ngrok http 3000
 * Then set the webhook URL to: https://<your-ngrok-id>.ngrok.io/api/webhooks/twilio
 *
 * ── Signature Verification ────────────────────────────────────────────
 *
 * Twilio signs every request using your Auth Token (TWILIO_AUTH_TOKEN).
 * The signature is sent in the `x-twilio-signature` header. This route
 * uses the official `twilio.validateRequest()` helper to verify it.
 * If TWILIO_AUTH_TOKEN is not set, signature verification is skipped
 * (for local dev only — always set it in production).
 *
 * @see https://www.twilio.com/docs/messaging/guides/webhook-request
 * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
 * @module api/webhooks/twilio
 */
import * as Sentry from "@sentry/nextjs";
import { format } from "date-fns";
import { and, eq, gte, inArray, isNull, asc } from "drizzle-orm";
import { validateRequest } from "twilio/lib/webhooks/webhooks";
import { db } from "@/db";
import { bookings, profiles, services, webhookEvents, syncLog } from "@/db/schema";
import { logAction } from "@/lib/audit";

const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

/* ------------------------------------------------------------------ */
/*  TwiML helper                                                       */
/* ------------------------------------------------------------------ */

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/* ------------------------------------------------------------------ */
/*  Parse the SMS command                                              */
/* ------------------------------------------------------------------ */

type SmsCommand = "confirm" | "cancel" | null;

function parseCommand(body: string): SmsCommand {
  const normalized = body.trim().toUpperCase();
  if (normalized === "C" || normalized === "CONFIRM") return "confirm";
  if (normalized === "X" || normalized === "CANCEL") return "cancel";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Normalize phone number for matching                                */
/* ------------------------------------------------------------------ */

/** Strip to digits-only, ensure leading 1 for US numbers. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body));

  // Validate Twilio signature
  if (authToken) {
    const signature = request.headers.get("x-twilio-signature") ?? "";
    const url = request.url;

    if (!validateRequest(authToken, signature, url, params)) {
      return new Response("Invalid signature", { status: 403 });
    }
  }

  const messageSid = params.MessageSid ?? "";
  const from = params.From ?? "";
  const messageBody = params.Body ?? "";

  // Store raw event
  const [webhookRow] = await db
    .insert(webhookEvents)
    .values({
      provider: "twilio",
      externalEventId: messageSid,
      eventType: "inbound_sms",
      payload: params as Record<string, unknown>,
      isProcessed: false,
      attempts: 1,
    })
    .returning({ id: webhookEvents.id });

  let result = "";
  let syncStatus: "success" | "failed" | "skipped" = "skipped";
  let replyMessage = "";

  try {
    // Parse command
    const command = parseCommand(messageBody);
    if (!command) {
      replyMessage =
        "Sorry, we didn't understand that. Reply C to confirm or X to cancel your upcoming appointment.";
      result = `Unrecognized command: "${messageBody}"`;
      syncStatus = "skipped";

      await markProcessed(webhookRow.id);
      await logSync(syncStatus, result, messageSid);
      return twiml(replyMessage);
    }

    // Match phone to client
    const normalized = normalizePhone(from);
    const [client] = await db
      .select({ id: profiles.id, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.phone, normalized));

    if (!client) {
      // Try without +1 prefix for profiles stored as 10-digit
      const digits10 = normalized.replace(/^\+1/, "");
      const [client2] = await db
        .select({ id: profiles.id, firstName: profiles.firstName })
        .from(profiles)
        .where(eq(profiles.phone, digits10));

      if (!client2) {
        replyMessage =
          "We couldn't find an account linked to this phone number. Please contact us directly.";
        result = `No profile found for phone: ${from}`;
        syncStatus = "skipped";

        await markProcessed(webhookRow.id);
        await logSync(syncStatus, result, messageSid);
        return twiml(replyMessage);
      }

      // Use the matched client
      Object.assign(client, client2);
    }

    // Find next upcoming booking (pending or confirmed)
    const targetStatuses = command === "confirm" ? ["pending"] : ["pending", "confirmed"];

    const [nextBooking] = await db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        status: bookings.status,
        serviceName: services.name,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(
          eq(bookings.clientId, client.id),
          inArray(bookings.status, targetStatuses),
          gte(bookings.startsAt, new Date()),
          isNull(bookings.deletedAt),
        ),
      )
      .orderBy(asc(bookings.startsAt))
      .limit(1);

    if (!nextBooking) {
      replyMessage =
        command === "confirm"
          ? "You don't have any upcoming bookings to confirm."
          : "You don't have any upcoming bookings to cancel.";
      result = `No upcoming ${targetStatuses.join("/")} booking for client ${client.id}`;
      syncStatus = "skipped";

      await markProcessed(webhookRow.id);
      await logSync(syncStatus, result, messageSid);
      return twiml(replyMessage);
    }

    const startsAtFormatted = format(nextBooking.startsAt, "EEEE, MMMM d 'at' h:mm a");

    // Update booking status
    if (command === "confirm") {
      await db
        .update(bookings)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(bookings.id, nextBooking.id));

      replyMessage = `Confirmed! Your ${nextBooking.serviceName} on ${startsAtFormatted} is all set. See you then!`;
      result = `Confirmed booking #${nextBooking.id} via SMS from ${from}`;
    } else {
      await db
        .update(bookings)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: "Cancelled via SMS",
        })
        .where(eq(bookings.id, nextBooking.id));

      replyMessage = `Your ${nextBooking.serviceName} on ${startsAtFormatted} has been cancelled. To rebook, visit our website or call us.`;
      result = `Cancelled booking #${nextBooking.id} via SMS from ${from}`;
    }

    syncStatus = "success";

    await logAction({
      actorId: client.id,
      action: "status_change",
      entityType: "booking",
      entityId: String(nextBooking.id),
      description: `Booking ${command}ed via SMS reply`,
      metadata: { command, from, messageSid },
    });

    await markProcessed(webhookRow.id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    syncStatus = "failed";
    result = errorMessage;
    replyMessage =
      "Something went wrong processing your request. Please try again or contact us directly.";

    Sentry.captureException(err);
    await db.update(webhookEvents).set({ errorMessage }).where(eq(webhookEvents.id, webhookRow.id));
  }

  await logSync(syncStatus, result, messageSid);
  return twiml(replyMessage);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function markProcessed(webhookEventId: number): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ isProcessed: true, processedAt: new Date() })
    .where(eq(webhookEvents.id, webhookEventId));
}

async function logSync(
  status: "success" | "failed" | "skipped",
  message: string,
  remoteId: string,
): Promise<void> {
  await db.insert(syncLog).values({
    provider: "twilio",
    direction: "inbound",
    status,
    entityType: "inbound_sms",
    remoteId,
    message,
  });
}
