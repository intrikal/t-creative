/**
 * Resend email client — singleton for server-side use only.
 *
 * Graceful degradation: when RESEND_API_KEY is missing the app still
 * boots (no-email mode). Always check `isResendConfigured()` before
 * calling any Resend API.
 *
 * Rate-limit handling (free tier: 100/day, configurable via RESEND_DAILY_LIMIT):
 * - Tracks daily send count in an in-process counter (resets at midnight UTC).
 * - At 80% of the daily limit a Sentry warning is fired.
 * - At 100% the email is queued in the `email_queue` table and sent the
 *   next day by the `cron/email-queue-drain` Inngest function.
 *
 * All send attempts are logged to `sync_log` for audit/debugging.
 *
 * @module lib/resend
 */
import * as Sentry from "@sentry/nextjs";
import { eq as drizzleEq } from "drizzle-orm";
import { Resend } from "resend";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { syncLog, profiles, emailQueue } from "@/db/schema";
import { withRetry } from "@/lib/retry";

const apiKey = process.env.RESEND_API_KEY;

/** Daily send limit. Default 100 (Resend free tier). Set to 50000 for Pro. */
const DAILY_LIMIT = parseInt(process.env.RESEND_DAILY_LIMIT ?? "100", 10);

/** Warn when this fraction of the daily limit is consumed. */
const WARN_THRESHOLD = 0.8;

/** Env-level fallback; overridden at runtime by BusinessProfile settings. */
const RESEND_FROM_FALLBACK =
  process.env.RESEND_FROM_EMAIL || "T Creative <noreply@tcreativestudio.com>";

// ─── In-process daily counter ────────────────────────────────────────────────
// Resets each time the UTC date changes. Good enough for serverless — each cold
// start resets to 0 but the queue fallback protects against actual overruns.

let _countDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
let _sendCount = 0;

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function incrementCounter(): number {
  const today = getTodayUTC();
  if (today !== _countDate) {
    _countDate = today;
    _sendCount = 0;
  }
  _sendCount += 1;
  return _sendCount;
}

function currentCount(): number {
  if (getTodayUTC() !== _countDate) return 0;
  return _sendCount;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the "From" header from the configured BusinessProfile.
 * Falls back to env variable if the DB read fails.
 */
async function getResendFrom(): Promise<string> {
  try {
    const profile = await getPublicBusinessProfile();
    return `${profile.emailSenderName} <${profile.emailFromAddress}>`;
  } catch {
    return RESEND_FROM_FALLBACK;
  }
}

/** @deprecated Use getResendFrom() instead — kept for backwards compat. */
export const RESEND_FROM = RESEND_FROM_FALLBACK;

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
    .where(drizzleEq(profiles.id, profileId));

  if (!row?.email || !row.notifyEmail) return null;
  return { email: row.email, firstName: row.firstName };
}

/**
 * Lazy-initialized Resend client.
 */
let _resend: Resend | null = null;
function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(apiKey!);
  }
  return _resend;
}

// ─── Queue fallback ───────────────────────────────────────────────────────────

/**
 * Queues a rate-limited email in the `email_queue` table.
 * The drain cron will retry it next day.
 */
async function queueEmail(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
  entityType: string;
  localId: string;
  replyTo?: string;
}): Promise<void> {
  await db.insert(emailQueue).values({
    to: params.to,
    subject: params.subject,
    html: params.html,
    from: params.from,
    entityType: params.entityType,
    localId: params.localId,
    status: "pending",
  });

  await db.insert(syncLog).values({
    provider: "resend",
    direction: "outbound",
    status: "skipped",
    entityType: params.entityType,
    localId: params.localId,
    message: `Rate limit reached — queued ${params.entityType} to ${params.to} for next-day send`,
    payload: { to: params.to, subject: params.subject, dailyLimit: DAILY_LIMIT },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send an email with rate-limit guard, sync_log audit trail, and queue
 * fallback. Non-fatal — catches errors so email failures never break the
 * main flow.
 *
 * Returns true if sent (or queued for later delivery) successfully.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Entity type for sync_log (e.g. "order_confirmation", "booking_confirmation") */
  entityType: string;
  /** Local record ID for sync_log tracing */
  localId: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!isResendConfigured()) {
    Sentry.captureMessage(`[resend] Not configured — skipping email: ${params.subject}`, "warning");
    return false;
  }

  const from = await getResendFrom();

  // ── Rate-limit check ──────────────────────────────────────────────────────
  const count = currentCount();
  const warnAt = Math.floor(DAILY_LIMIT * WARN_THRESHOLD);

  if (count >= DAILY_LIMIT) {
    // Hard limit hit — render to HTML for queue storage, then queue for next day.
    Sentry.captureMessage(
      `[resend] Daily limit of ${DAILY_LIMIT} reached — queuing email: ${params.subject}`,
      { level: "warning", extra: { to: params.to, entityType: params.entityType, count } },
    );
    try {
      const { renderToStaticMarkup } = await import("react-dom/server");
      const html = renderToStaticMarkup(params.react);
      await queueEmail({
        to: params.to,
        subject: params.subject,
        html,
        from,
        entityType: params.entityType,
        localId: params.localId,
        replyTo: params.replyTo,
      });
      return true; // queued counts as success from caller's perspective
    } catch (queueErr) {
      Sentry.captureException(queueErr);
      return false;
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  try {
    const { data, error } = await withRetry(
      async () => {
        const result = await getResendClient().emails.send({
          from,
          to: params.to,
          subject: params.subject,
          react: params.react,
          ...(params.replyTo ? { replyTo: params.replyTo } : {}),
        });
        if (result.error) {
          const err = Object.assign(new Error(result.error.message), {
            statusCode: (result.error as { statusCode?: number }).statusCode,
          });
          throw err;
        }
        return result;
      },
      { label: "resend.emails.send" },
    );

    const newCount = incrementCounter();

    // ── Warn at 80% ──────────────────────────────────────────────────────────
    if (newCount >= warnAt && newCount < DAILY_LIMIT) {
      Sentry.captureMessage(
        `[resend] Approaching daily limit: ${newCount}/${DAILY_LIMIT} emails sent today`,
        { level: "warning", extra: { dailyLimit: DAILY_LIMIT, warnAt, count: newCount } },
      );
    }

    await db.insert(syncLog).values({
      provider: "resend",
      direction: "outbound",
      status: "success",
      entityType: params.entityType,
      localId: params.localId,
      remoteId: data?.id ?? null,
      message: `Sent ${params.entityType} to ${params.to}`,
      payload: {
        to: params.to,
        subject: params.subject,
        resendId: data?.id,
        dailySendCount: newCount,
      },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown email error";
    Sentry.captureException(err);

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

/**
 * Send a plain-HTML email through the wrapper (for callsites that already
 * build HTML rather than React elements). Accepts the same rate-limit,
 * queue fallback, and audit trail as sendEmail().
 */
export async function sendEmailHtml(params: {
  to: string;
  subject: string;
  html: string;
  entityType: string;
  localId: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!isResendConfigured()) {
    Sentry.captureMessage(`[resend] Not configured — skipping email: ${params.subject}`, "warning");
    return false;
  }

  const from = await getResendFrom();
  const count = currentCount();
  const warnAt = Math.floor(DAILY_LIMIT * WARN_THRESHOLD);

  if (count >= DAILY_LIMIT) {
    Sentry.captureMessage(
      `[resend] Daily limit of ${DAILY_LIMIT} reached — queuing email: ${params.subject}`,
      { level: "warning", extra: { to: params.to, entityType: params.entityType, count } },
    );
    try {
      await queueEmail({ ...params, from });
      return true;
    } catch (queueErr) {
      Sentry.captureException(queueErr);
      return false;
    }
  }

  try {
    const { data, error } = await withRetry(
      async () => {
        const result = await getResendClient().emails.send({
          from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          ...(params.replyTo ? { replyTo: params.replyTo } : {}),
        });
        if (result.error) {
          const err = Object.assign(new Error(result.error.message), {
            statusCode: (result.error as { statusCode?: number }).statusCode,
          });
          throw err;
        }
        return result;
      },
      { label: "resend.emails.send" },
    );

    const newCount = incrementCounter();

    if (newCount >= warnAt && newCount < DAILY_LIMIT) {
      Sentry.captureMessage(
        `[resend] Approaching daily limit: ${newCount}/${DAILY_LIMIT} emails sent today`,
        { level: "warning", extra: { dailyLimit: DAILY_LIMIT, warnAt, count: newCount } },
      );
    }

    await db.insert(syncLog).values({
      provider: "resend",
      direction: "outbound",
      status: "success",
      entityType: params.entityType,
      localId: params.localId,
      remoteId: data?.id ?? null,
      message: `Sent ${params.entityType} to ${params.to}`,
      payload: {
        to: params.to,
        subject: params.subject,
        resendId: data?.id,
        dailySendCount: newCount,
      },
    });

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown email error";
    Sentry.captureException(err);

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
