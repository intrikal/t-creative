/**
 * PostHog server-side analytics — singleton for server actions and API routes.
 *
 * Graceful degradation: when POSTHOG_API_KEY is missing the app still boots
 * (no-analytics mode). Always check `isPostHogConfigured()` before calling.
 *
 * @module lib/posthog
 */
import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** Whether PostHog server-side API key is configured. */
export function isPostHogConfigured(): boolean {
  return !!apiKey;
}

/** Lazy-initialized PostHog client. */
let _posthog: PostHog | null = null;
function getPostHogServer(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(apiKey!, { host, flushAt: 1, flushInterval: 0 });
  }
  return _posthog;
}

/**
 * Track a server-side event. Non-fatal — catches errors so analytics
 * failures never break the main flow.
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
    console.error("[posthog] Failed to track event:", err);
  }
}

/**
 * Identify a user with person properties. Call after auth to link
 * anonymous pageviews to the real user profile.
 */
export function identifyUser(distinctId: string, properties: Record<string, unknown>): void {
  if (!isPostHogConfigured()) return;

  try {
    getPostHogServer().identify({ distinctId, properties });
  } catch (err) {
    console.error("[posthog] Failed to identify user:", err);
  }
}
