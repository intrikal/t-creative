/**
 * Resend email client — singleton for server-side use only.
 *
 * Graceful degradation: when RESEND_API_KEY is missing the app still
 * boots (no-email mode). Always check `isResendConfigured()` before
 * calling any Resend API.
 *
 * All send attempts are logged to `sync_log` for audit/debugging.
 *
 * @module lib/resend
 */
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { syncLog, profiles } from "@/db/schema";

const apiKey = process.env.RESEND_API_KEY;

export const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "T Creative <noreply@tcreativestudio.com>";

/** Whether Resend API key is configured. */
export function isResendConfigured(): boolean {
  return !!apiKey;
}

/**
 * Fetch a profile's email + notifyEmail preference.
 * Returns null if profile not found or email notifications disabled.
 */
export async function getEmailRecipient(
  profileId: string,
): Promise<{ email: string; firstName: string } | null> {
  const [row] = await db
    .select({
      email: profiles.email,
      firstName: profiles.firstName,
      notifyEmail: profiles.notifyEmail,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId));

  if (!row?.email || !row.notifyEmail) return null;
  return { email: row.email, firstName: row.firstName };
}

/** Lazy-initialized Resend client (avoids constructor throw when key is missing). */
let _resend: Resend | null = null;
function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(apiKey!);
  }
  return _resend;
}

/**
 * Send an email with sync_log audit trail. Non-fatal — catches errors
 * and logs them so email failures never break the main flow.
 *
 * Returns true if sent successfully.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Entity type for sync_log (e.g. "order_confirmation", "booking_confirmation") */
  entityType: string;
  /** Local record ID for sync_log tracing */
  localId: string;
}): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn("[resend] Not configured — skipping email:", params.subject);
    return false;
  }

  try {
    const { data, error } = await getResendClient().emails.send({
      from: RESEND_FROM,
      to: params.to,
      subject: params.subject,
      react: params.react,
    });

    if (error) throw new Error(error.message);

    await db.insert(syncLog).values({
      provider: "resend",
      direction: "outbound",
      status: "success",
      entityType: params.entityType,
      localId: params.localId,
      remoteId: data?.id ?? null,
      message: `Sent ${params.entityType} to ${params.to}`,
      payload: { to: params.to, subject: params.subject, resendId: data?.id },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown email error";
    console.error("[resend] Failed to send email:", errorMessage);

    await db.insert(syncLog).values({
      provider: "resend",
      direction: "outbound",
      status: "failed",
      entityType: params.entityType,
      localId: params.localId,
      message: `Failed to send ${params.entityType} to ${params.to}`,
      errorMessage,
    });

    return false;
  }
}
