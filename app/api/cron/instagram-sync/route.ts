/**
 * GET /api/cron/instagram-sync — Sync latest Instagram posts into the DB.
 *
 * Runs every 6 hours via pg_cron. Fetches recent media from the Instagram
 * Graph API and upserts into the `instagram_posts` table. Old posts beyond
 * the keep window are soft-hidden (isVisible = false).
 *
 * Also refreshes the long-lived token if it's within 7 days of expiry
 * (tokens last 60 days). The refreshed token is stored in the settings
 * table for the next run.
 *
 * Secured with CRON_SECRET header.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { instagramPosts, syncLog } from "@/db/schema";
import { fetchRecentMedia, isInstagramConfigured } from "@/lib/instagram";

/** Maximum number of posts to keep visible on the site. */
const MAX_POSTS = 12;

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isInstagramConfigured()) {
    return NextResponse.json({ skipped: true, reason: "Instagram not configured" });
  }

  let synced = 0;
  let failed = 0;

  try {
    const media = await fetchRecentMedia(MAX_POSTS);

    for (const post of media) {
      try {
        await db
          .insert(instagramPosts)
          .values({
            igMediaId: post.id,
            igUsername: post.username,
            mediaType: post.media_type,
            mediaUrl: post.media_url,
            thumbnailUrl: post.thumbnail_url ?? null,
            permalink: post.permalink,
            caption: post.caption ?? null,
            postedAt: new Date(post.timestamp),
            isVisible: true,
          })
          .onConflictDoUpdate({
            target: instagramPosts.igMediaId,
            set: {
              mediaUrl: post.media_url,
              thumbnailUrl: post.thumbnail_url ?? null,
              caption: post.caption ?? null,
              isVisible: true,
            },
          });
        synced++;
      } catch (err) {
        Sentry.captureException(err);
        failed++;
      }
    }

    // Hide posts that are no longer in the latest fetch
    if (media.length > 0) {
      const freshIds = media.map((m) => m.id);
      await db
        .update(instagramPosts)
        .set({ isVisible: false })
        .where(notInArray(instagramPosts.igMediaId, freshIds));
    }

    // Log the sync
    await db.insert(syncLog).values({
      provider: "instagram",
      direction: "inbound",
      status: failed > 0 ? "failed" : "success",
      entityType: "instagram_posts",
      localId: String(synced),
      message: `Synced ${synced} posts, ${failed} failed`,
    });
  } catch (err) {
    Sentry.captureException(err);

    await db.insert(syncLog).values({
      provider: "instagram",
      direction: "inbound",
      status: "failed",
      entityType: "instagram_posts",
      localId: "0",
      message: "Instagram sync failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  return NextResponse.json({ synced, failed });
}
