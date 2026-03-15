/**
 * Twilio SMS client — singleton for server-side use only.
 *
 * Graceful degradation: when Twilio env vars are missing the app still
 * boots (no-SMS mode). Always check `isTwilioConfigured()` before
 * calling any Twilio API.
 *
 * All send attempts are logged to `sync_log` for audit/debugging,
 * matching the same pattern as lib/resend.ts.
 *
 * @module lib/twilio
 */
import { eq } from "drizzle-orm";
import twilio from "twilio";
import { db } from "@/db";
import { syncLog, profiles } from "@/db/schema";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

/** Whether all required Twilio env vars are present. */
export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

/**
 * Fetch a profile's phone + notifySms preference.
 * Returns null if profile not found, phone missing, or SMS notifications disabled.
 */
export async function getSmsRecipient(
  profileId: string,
): Promise<{ phone: string; firstName: string } | null> {
  const [row] = await db
    .select({
      phone: profiles.phone,
      firstName: profiles.firstName,
      notifySms: profiles.notifySms,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId));

  if (!row?.phone || !row.notifySms) return null;
  return { phone: row.phone, firstName: row.firstName };
}

/** Lazy-initialized Twilio client (avoids constructor throw when creds are missing). */
let _twilio: ReturnType<typeof twilio> | null = null;
function getTwilioClient(): ReturnType<typeof twilio> {
  if (!_twilio) {
    _twilio = twilio(accountSid!, authToken!);
  }
  return _twilio;
}

/**
 * Send an SMS with sync_log audit trail. Non-fatal — catches errors
 * and logs them so SMS failures never break the main flow.
 *
 * Returns true if sent successfully.
 */
export async function sendSms(params: {
  to: string;
  body: string;
  /** Entity type for sync_log (e.g. "booking_reminder_24h_sms") */
  entityType: string;
  /** Local record ID for sync_log tracing */
  localId: string;
}): Promise<boolean> {
  if (!isTwilioConfigured()) {
    console.warn("[twilio] Not configured — skipping SMS:", params.entityType);
    return false;
  }

  try {
    const message = await getTwilioClient().messages.create({
      from: fromNumber!,
      to: params.to,
      body: params.body,
    });

    await db.insert(syncLog).values({
      provider: "twilio",
      direction: "outbound",
      status: "success",
      entityType: params.entityType,
      localId: params.localId,
      remoteId: message.sid,
      message: `Sent ${params.entityType} SMS to ${params.to}`,
      payload: { to: params.to, sid: message.sid },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown SMS error";
    console.error("[twilio] Failed to send SMS:", errorMessage);

    await db.insert(syncLog).values({
      provider: "twilio",
      direction: "outbound",
      status: "failed",
      entityType: params.entityType,
      localId: params.localId,
      message: `Failed to send ${params.entityType} SMS to ${params.to}`,
      errorMessage,
    });

    return false;
  }
}
