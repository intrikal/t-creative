/**
 * lib/retry.ts — Generic retry helper for external API calls.
 *
 * Handles two distinct failure modes:
 *
 * 1. **Rate limit (429)** — respects the `Retry-After` header when present,
 *    otherwise falls back to the configured backoff for that attempt.
 *
 * 2. **Transient errors (network, 5xx)** — retries with exponential backoff.
 *    Non-retryable errors (4xx except 429, business logic errors) are thrown
 *    immediately without consuming retry budget.
 *
 * Usage:
 *   const result = await withRetry(() => squareClient.payments.create(...));
 *   const result = await withRetry(() => resend.emails.send(...), {
 *     maxRetries: 2,
 *     backoff: [500, 1000],
 *   });
 */
import * as Sentry from "@sentry/nextjs";

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (not counting the initial attempt).
   * Default: 3
   */
  maxRetries?: number;
  /**
   * Wait times in milliseconds between consecutive attempts.
   * `backoff[0]` is used before the 1st retry, `backoff[1]` before the 2nd, etc.
   * If there are fewer entries than `maxRetries`, the last value is reused.
   * Default: [1000, 2000, 4000]
   */
  backoff?: number[];
  /**
   * Optional label for Sentry breadcrumbs (e.g. "square.payments.create").
   */
  label?: string;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF: [number, number, number] = [1000, 2000, 4000];

/** Pause execution for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the HTTP status code from an error thrown by Square, Resend,
 * or Twilio. Returns `undefined` if the error isn't an HTTP error.
 *
 * - Square SDK:  `err.statusCode`  (SquareApiError)
 * - Resend SDK:  `err.statusCode`  (ResendError — same shape)
 * - Twilio SDK:  `err.status`      (RestException)
 * - fetch():     `err.status`      (Response-like)
 */
function extractStatusCode(err: unknown): number | undefined {
  if (err !== null && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e["statusCode"] === "number") return e["statusCode"];
    if (typeof e["status"] === "number") return e["status"];
  }
  return undefined;
}

/**
 * Extract the `Retry-After` header value in milliseconds.
 *
 * Square SDK exposes response headers on `err.headers` (a plain object or
 * a Headers-like map). Resend/Twilio don't surface headers on the error
 * object, so we fall back to `undefined` and use the configured backoff.
 */
function extractRetryAfterMs(err: unknown): number | undefined {
  if (err !== null && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const headers = e["headers"];
    if (headers !== null && typeof headers === "object") {
      const h = headers as Record<string, unknown>;
      // Headers may be a plain object or a Headers instance
      const raw =
        typeof (headers as { get?: (k: string) => string | null }).get === "function"
          ? (headers as { get: (k: string) => string | null }).get("retry-after")
          : (h["retry-after"] ?? h["Retry-After"]);
      if (typeof raw === "string" || typeof raw === "number") {
        const seconds = Number(raw);
        if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
      }
    }
  }
  return undefined;
}

/**
 * Returns true for errors that are worth retrying.
 *
 * - 429 Too Many Requests → always retry (with Retry-After if available)
 * - 5xx Server Error       → retry (transient server issue)
 * - Network errors (no statusCode) → retry
 * - 4xx except 429         → do NOT retry (caller sent a bad request)
 */
function isRetryable(err: unknown): boolean {
  const status = extractStatusCode(err);
  if (status === undefined) return true; // network error — retry
  if (status === 429) return true;
  if (status >= 500) return true;
  return false; // 4xx (except 429) — permanent, don't retry
}

/**
 * Executes `fn` with automatic retry on rate-limit and transient errors.
 *
 * @param fn      The async operation to attempt.
 * @param opts    Retry configuration (maxRetries, backoff schedule, label).
 * @returns       The resolved value of `fn` on success.
 * @throws        The last error after all retries are exhausted, or the
 *                first non-retryable error immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoff = opts.backoff ?? DEFAULT_BACKOFF;
  const label = opts.label ?? "withRetry";

  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      // Don't retry non-retryable errors (e.g. 400 Bad Request, 401, 403, 404)
      if (!isRetryable(err)) throw err;

      // No retries remaining — fall through to throw
      if (attempt >= maxRetries) break;

      const status = extractStatusCode(err);
      const isRateLimit = status === 429;

      // Determine wait time: Retry-After header takes precedence over backoff
      const retryAfterMs = isRateLimit ? extractRetryAfterMs(err) : undefined;
      const backoffMs = backoff[attempt] ?? backoff[backoff.length - 1];
      const waitMs = retryAfterMs ?? backoffMs;

      Sentry.addBreadcrumb({
        category: "retry",
        message: `[${label}] attempt ${attempt + 1}/${maxRetries + 1} failed (${isRateLimit ? "429 rate limit" : `status ${status ?? "network"}`}), retrying in ${waitMs}ms`,
        level: "warning",
        data: { attempt, status, waitMs, retryAfterMs },
      });

      await sleep(waitMs);
    }
  }

  // All attempts exhausted — capture and rethrow
  Sentry.captureException(lastErr, {
    tags: { retry_label: label, retry_exhausted: "true" },
  });
  throw lastErr;
}
