/**
 * Google Calendar API client — OAuth2 token management and calendar operations.
 *
 * Uses Google's REST API directly (no extra SDK needed — just fetch).
 * Tokens are stored in `google_calendar_tokens` and refreshed automatically
 * when expired.
 *
 * ## OAuth2 flow
 * 1. Staff clicks "Connect Google Calendar" → redirected to Google consent
 * 2. Google redirects back to `/api/auth/google-calendar/callback` with a code
 * 3. Callback exchanges code for tokens, stores them, redirects to settings
 *
 * ## Token lifecycle
 * Access tokens expire after ~1 hour. `refreshAccessToken()` uses the stored
 * refresh token to obtain a new access token transparently before any API call.
 *
 * @module lib/google-calendar
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleCalendarTokens } from "@/db/schema";
import logger from "@/lib/logger";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return secret;
}

function getRedirectUri(): string {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google-calendar/callback`
  );
}

/**
 * Get a valid access token for a profile, refreshing if expired.
 * Returns null if no token row exists.
 */
async function getValidAccessToken(profileId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  if (!row) return null;

  const isExpired = row.tokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (!isExpired) return row.accessToken;

  return refreshAccessToken(profileId);
}

/**
 * Make an authenticated request to the Google Calendar API.
 * Throws on HTTP errors with a descriptive message.
 */
async function calendarFetch(
  profileId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getValidAccessToken(profileId);
  if (!token) throw new Error(`No Google Calendar token found for profile ${profileId}`);

  const response = await fetch(`${CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Google Calendar API error ${response.status}: ${body}`);
    Sentry.captureException(err);
    throw err;
  }

  return response;
}

/* ------------------------------------------------------------------ */
/*  OAuth2 flow                                                        */
/* ------------------------------------------------------------------ */

/**
 * Generate a Google OAuth2 consent URL that the user should be redirected to.
 * The `state` parameter carries the profileId so the callback can associate
 * the tokens with the right user.
 */
export function getGoogleAuthUrl(profileId: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: profileId,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Returns the parsed token response from Google.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Google token exchange failed (${response.status}): ${body}`);
    Sentry.captureException(err);
    throw err;
  }

  return (await response.json()) as GoogleTokenResponse;
}

/**
 * Refresh an expired access token using the stored refresh token.
 * Updates the database row and returns the new access token.
 */
export async function refreshAccessToken(profileId: string): Promise<string> {
  const [row] = await db
    .select({ refreshToken: googleCalendarTokens.refreshToken })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  if (!row) throw new Error(`No Google Calendar token found for profile ${profileId}`);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Google token refresh failed (${response.status}): ${body}`);
    Sentry.captureException(err);
    throw err;
  }

  const tokens = (await response.json()) as GoogleTokenResponse;

  await db
    .update(googleCalendarTokens)
    .set({
      accessToken: tokens.access_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })
    .where(eq(googleCalendarTokens.profileId, profileId));

  logger.info({ profileId }, "refreshed Google Calendar access token");

  return tokens.access_token;
}

/* ------------------------------------------------------------------ */
/*  Calendar event operations                                          */
/* ------------------------------------------------------------------ */

/**
 * Create a new event on the user's Google Calendar.
 * Returns the created event's Google ID.
 */
export async function createCalendarEvent(
  profileId: string,
  event: CalendarEvent,
): Promise<string> {
  const [row] = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  const calendarId = encodeURIComponent(row?.calendarId ?? "primary");
  const response = await calendarFetch(profileId, `/calendars/${calendarId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });

  const created = (await response.json()) as { id: string };
  logger.info({ profileId, eventId: created.id }, "created Google Calendar event");
  return created.id;
}

/**
 * Update an existing event on the user's Google Calendar.
 */
export async function updateCalendarEvent(
  profileId: string,
  eventId: string,
  event: CalendarEvent,
): Promise<void> {
  const [row] = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  const calendarId = encodeURIComponent(row?.calendarId ?? "primary");
  await calendarFetch(profileId, `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(event),
  });

  logger.info({ profileId, eventId }, "updated Google Calendar event");
}

/**
 * Delete an event from the user's Google Calendar.
 */
export async function deleteCalendarEvent(profileId: string, eventId: string): Promise<void> {
  const [row] = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  const calendarId = encodeURIComponent(row?.calendarId ?? "primary");
  await calendarFetch(profileId, `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });

  logger.info({ profileId, eventId }, "deleted Google Calendar event");
}

/* ------------------------------------------------------------------ */
/*  Calendar watch (push notifications)                                */
/* ------------------------------------------------------------------ */

/** 7 days in milliseconds — Google's maximum watch expiration. */
const WATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Subscribe to push notifications for changes on a staff member's calendar.
 *
 * Google will POST to our webhook endpoint whenever an event is created,
 * updated, or deleted on the watched calendar. The watch expires after 7
 * days and must be renewed by `renew-calendar-watches` Inngest function.
 */
export async function watchCalendar(profileId: string): Promise<void> {
  const [row] = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  const calendarId = encodeURIComponent(row?.calendarId ?? "primary");
  const channelId = `gcal-watch-${profileId}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const webhookUrl = `${siteUrl}/api/webhooks/google-calendar`;

  const expiration = Date.now() + WATCH_TTL_MS;

  const response = await calendarFetch(profileId, `/calendars/${calendarId}/events/watch`, {
    method: "POST",
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      expiration,
    }),
  });

  const result = (await response.json()) as { resourceId: string; expiration: string };

  await db
    .update(googleCalendarTokens)
    .set({
      watchChannelId: channelId,
      watchResourceId: result.resourceId,
      watchExpiresAt: new Date(Number(result.expiration)),
    })
    .where(eq(googleCalendarTokens.profileId, profileId));

  logger.info(
    { profileId, channelId, expiration: result.expiration },
    "started Google Calendar watch",
  );
}

/**
 * Stop an existing calendar watch. Called when a user disconnects their
 * Google Calendar or when renewing (stop old → start new).
 */
export async function stopWatchCalendar(profileId: string): Promise<void> {
  const [row] = await db
    .select({
      watchChannelId: googleCalendarTokens.watchChannelId,
      watchResourceId: googleCalendarTokens.watchResourceId,
    })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  if (!row?.watchChannelId || !row?.watchResourceId) return;

  try {
    await calendarFetch(profileId, "/channels/stop", {
      method: "POST",
      body: JSON.stringify({
        id: row.watchChannelId,
        resourceId: row.watchResourceId,
      }),
    });
  } catch {
    // Watch may have already expired — safe to ignore.
  }

  await db
    .update(googleCalendarTokens)
    .set({
      watchChannelId: null,
      watchResourceId: null,
      watchExpiresAt: null,
    })
    .where(eq(googleCalendarTokens.profileId, profileId));

  logger.info({ profileId }, "stopped Google Calendar watch");
}
