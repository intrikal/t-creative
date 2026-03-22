/**
 * lib/web-push — Web Push notification sender.
 *
 * Wraps the `web-push` library with VAPID configuration and a
 * convenience function for sending notifications to subscribed clients.
 *
 * @module lib/web-push
 */
import * as Sentry from "@sentry/nextjs";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL
  ? `mailto:hello@${new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname}`
  : "mailto:hello@tcreative.studio";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/** Whether web push is configured (both VAPID keys present). */
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
};

/**
 * Sends a push notification to all subscriptions for a given profile.
 *
 * Automatically removes expired/invalid subscriptions (410 Gone).
 * Returns the number of notifications successfully sent.
 */
export async function sendPushNotification(
  profileId: string,
  payload: PushPayload,
): Promise<number> {
  if (!isPushConfigured()) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.profileId, profileId));

  if (subs.length === 0) return 0;

  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;

      // 410 Gone or 404 — subscription is no longer valid, remove it
      if (statusCode === 410 || statusCode === 404) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
      } else {
        Sentry.captureException(err);
      }
    }
  }

  return sent;
}
