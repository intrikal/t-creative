/**
 * Inngest function — Sync latest Instagram posts into the DB.
 *
 * Replaces GET /api/cron/instagram-sync. Fetches recent media from the
 * Instagram Graph API and upserts into the instagram_posts table. Old posts
 * beyond the keep window are soft-hidden (isVisible = false).
 */
import * as Sentry from "@sentry/nextjs";
import { eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { instagramPosts, syncLog } from "@/db/schema";
import { fetchRecentMedia, isInstagramConfigured } from "@/lib/instagram";
import { inngest } from "../client";

/** Maximum number of posts to keep visible on the site. */
const MAX_POSTS = 12;

export const instagramSync = inngest.createFunction(
  { id: "instagram-sync", retries: 3, triggers: [{ event: "cron/instagram-sync" }] },
  async ({ step }) => {
    const configured = await step.run("check-config", async () => {
      return isInstagramConfigured();
    });

    if (!configured) {
      return { skipped: true, reason: "Instagram not configured" };
    }

    const media = await step.run("fetch-media", async () => {
      try {
        return await fetchRecentMedia(MAX_POSTS);
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

        throw err;
      }
    });

    let synced = 0;
    let failed = 0;

    for (const post of media) {
      const result = await step.run(`process-${post.id}`, async () => {
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
          return { synced: 1, failed: 0 };
        } catch (err) {
          Sentry.captureException(err);
          return { synced: 0, failed: 1 };
        }
      });

      synced += result.synced;
      failed += result.failed;
    }

    // Hide posts that are no longer in the latest fetch
    await step.run("hide-old-posts", async () => {
      if (media.length > 0) {
        const freshIds = media.map((m) => m.id);
        await db
          .update(instagramPosts)
          .set({ isVisible: false })
          .where(notInArray(instagramPosts.igMediaId, freshIds));
      }
    });

    // Log the sync
    await step.run("log-sync", async () => {
      await db.insert(syncLog).values({
        provider: "instagram",
        direction: "inbound",
        status: failed > 0 ? "failed" : "success",
        entityType: "instagram_posts",
        localId: String(synced),
        message: `Synced ${synced} posts, ${failed} failed`,
      });
    });

    return { synced, failed };
  },
);
