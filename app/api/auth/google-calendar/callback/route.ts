/**
 * GET /api/auth/google-calendar/callback — OAuth2 callback for Google Calendar.
 *
 * Google redirects here after the user grants calendar access. This route:
 * 1. Validates the `code` and `state` (profileId) query params
 * 2. Exchanges the auth code for access + refresh tokens via Google's token endpoint
 * 3. Upserts the token row in `google_calendar_tokens`
 * 4. Redirects the user back to /dashboard/settings with a success message
 *
 * The `state` param carries the profile ID so we know which user initiated the
 * flow. In a production hardening pass this should be replaced with a signed,
 * time-limited CSRF token.
 *
 * @module app/api/auth/google-calendar/callback/route
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleCalendarTokens } from "@/db/schema";
import { exchangeCodeForTokens, watchCalendar } from "@/lib/google-calendar";
import logger from "@/lib/logger";
import { withRequestLogger } from "@/lib/middleware/request-logger";

export const GET = withRequestLogger(async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const profileId = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const dashboardUrl = new URL("/dashboard/settings", url.origin);

  if (error) {
    dashboardUrl.searchParams.set("gcal_error", error);
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !profileId) {
    dashboardUrl.searchParams.set("gcal_error", "missing_params");
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };

    // Upsert: update if this profile already has a row, insert otherwise.
    const [existing] = await db
      .select({ id: googleCalendarTokens.id })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.profileId, profileId))
      .limit(1);

    if (existing) {
      await db
        .update(googleCalendarTokens)
        .set(tokenData)
        .where(eq(googleCalendarTokens.profileId, profileId));
    } else {
      await db.insert(googleCalendarTokens).values({
        profileId,
        ...tokenData,
      });
    }

    // Start watching the calendar for push notifications (fire-and-forget).
    watchCalendar(profileId).catch((err) => {
      Sentry.captureException(err);
      logger.error({ err, profileId }, "failed to start calendar watch after OAuth");
    });

    dashboardUrl.searchParams.set("gcal_connected", "true");
    return NextResponse.redirect(dashboardUrl);
  } catch (err) {
    Sentry.captureException(err);
    dashboardUrl.searchParams.set("gcal_error", "token_exchange_failed");
    return NextResponse.redirect(dashboardUrl);
  }
});
