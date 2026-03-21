/**
 * PostHog server-side analytics — singleton for server actions and API routes.
 *
 * Graceful degradation: when POSTHOG_API_KEY is missing the app still boots
 * (no-analytics mode). Always check `isPostHogConfigured()` before calling.
 *
 * @module lib/posthog
 */
import * as Sentry from "@sentry/nextjs";
import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** Whether PostHog server-side API key is configured. */
export function isPostHogConfigured(): boolean {
  return !!apiKey;
}

/**
 * Lazy-initialized PostHog client singleton.
 *
 * `flushAt: 1` and `flushInterval: 0` means events are sent immediately
 * rather than batched. This is intentional for server-side usage where
 * the process may terminate between requests (serverless) — batching
 * risks dropping events that haven't been flushed yet.
 */
let _posthog: PostHog | null = null;
function getPostHogServer(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(apiKey!, { host, flushAt: 1, flushInterval: 0 });
  }
  return _posthog;
}

/**
 * Track a server-side event in PostHog.
 *
 * Non-fatal — catches and reports errors to Sentry so analytics
 * failures never break the main flow. No-ops silently when PostHog
 * is not configured (dev / preview environments).
 *
 * @param distinctId - The user identifier (typically profiles.id UUID).
 * @param event - Event name (e.g. "booking_created", "review_submitted").
 * @param properties - Optional key-value metadata attached to the event.
 */
export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!isPostHogConfigured()) return;

  try {
    getPostHogServer().capture({ distinctId, event, properties });
  } catch (err) {
    Sentry.captureException(err);
  }
}

/**
 * Identify a user with person properties in PostHog.
 *
 * Call after authentication to merge the anonymous session with the
 * real user profile. Properties typically include email, role, and
 * any profile metadata useful for segmentation.
 *
 * @param distinctId - The user identifier (profiles.id UUID).
 * @param properties - Person properties to set (e.g. { email, role, plan }).
 */
export function identifyUser(distinctId: string, properties: Record<string, unknown>): void {
  if (!isPostHogConfigured()) return;

  try {
    getPostHogServer().identify({ distinctId, properties });
  } catch (err) {
    Sentry.captureException(err);
  }
}
