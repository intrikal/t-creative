/**
 * Instagram Graph API client — fetches recent media for display on the landing page.
 *
 * Uses a long-lived Instagram User Token (valid 60 days, auto-refreshed by
 * the cron job before expiry). The token must have `user_media` and
 * `user_profile` permissions.
 *
 * Env vars:
 * - `INSTAGRAM_ACCESS_TOKEN` — long-lived user token
 *
 * @see https://developers.facebook.com/docs/instagram-basic-display-api/
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
 * @module lib/instagram
 */
import * as Sentry from "@sentry/nextjs";

const GRAPH_BASE = "https://graph.instagram.com";

export interface InstagramMedia {
  id: string;
  username: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

/** Whether Instagram credentials are configured. */
export function isInstagramConfigured(): boolean {
  return !!process.env.INSTAGRAM_ACCESS_TOKEN;
}

/**
 * Fetches the most recent media from the authenticated Instagram account.
 * Returns up to `limit` posts (default 12).
 */
export async function fetchRecentMedia(limit = 12): Promise<InstagramMedia[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not configured");

  const fields = "id,username,media_type,media_url,thumbnail_url,permalink,caption,timestamp";
  const url = `${GRAPH_BASE}/me/media?fields=${fields}&limit=${limit}&access_token=${token}`;

  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Instagram API error ${res.status}: ${body}`);
    Sentry.captureException(err);
    throw err;
  }

  const json = (await res.json()) as { data?: InstagramMedia[] };
  return json.data ?? [];
}

/**
 * Refreshes a long-lived token before it expires (tokens are valid 60 days).
 * Returns the new token string. The cron job should call this and update
 * the env var or settings table accordingly.
 */
export async function refreshLongLivedToken(): Promise<string> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not configured");

  const url = `${GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Instagram token refresh failed ${res.status}: ${body}`);
    Sentry.captureException(err);
    throw err;
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  return json.access_token;
}
