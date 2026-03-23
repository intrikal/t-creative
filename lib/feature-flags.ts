/**
 * PostHog server-side feature flag helpers.
 *
 * Flags are defined in the PostHog dashboard — not in code. This module is
 * purely plumbing so flag checks are ready when needed (e.g. gating
 * assistant-dashboard, multi-location, or email-sequences features).
 *
 * Known flags (create in PostHog dashboard before use):
 *   - assistant-dashboard   Gates the AI assistant section (ready when Trini hires staff)
 *   - multi-location        Enables multi-location studio management
 *   - email-sequences       Enables automated email sequence builder
 *
 * @module lib/feature-flags
 */
import * as Sentry from "@sentry/nextjs";
import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let _posthog: PostHog | null = null;
function getClient(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(apiKey!, { host, flushAt: 1, flushInterval: 0 });
  }
  return _posthog;
}

/**
 * Check whether a PostHog feature flag is enabled for a given user.
 *
 * Returns `false` when PostHog is not configured (dev / preview) so callers
 * can safely default to the non-flagged path without crashing.
 *
 * @param flag       - The flag key as defined in the PostHog dashboard.
 * @param distinctId - The user identifier (profiles.id UUID).
 */
export async function isFeatureEnabled(flag: string, distinctId: string): Promise<boolean> {
  if (!apiKey) return false;

  try {
    const enabled = await getClient().isFeatureEnabled(flag, distinctId);
    return enabled === true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}
