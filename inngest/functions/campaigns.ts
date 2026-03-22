/**
 * Inngest function — Batch sync subscribers to Zoho Campaigns.
 *
 * Replaces GET /api/cron/campaigns. Finds all profiles with notifyMarketing=true
 * that haven't been synced to Zoho Campaigns yet and syncs them.
 */
import * as Sentry from "@sentry/nextjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { syncCampaignsSubscriber, isZohoCampaignsConfigured } from "@/lib/zoho-campaigns";
import { inngest } from "../client";

const BATCH_SIZE = 50;

export const campaigns = inngest.createFunction(
  { id: "campaigns", retries: 3, triggers: [{ event: "cron/campaigns" }] },
  async ({ step }) => {
    const configured = await step.run("check-config", async () => {
      return isZohoCampaignsConfigured();
    });

    if (!configured) {
      return { message: "Zoho Campaigns not configured, skipping" };
    }

    const unsyncedProfiles = await step.run("query-records", async () => {
      return db
        .select({
          id: profiles.id,
          email: profiles.email,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          isVip: profiles.isVip,
          source: profiles.source,
          tags: profiles.tags,
          onboardingData: profiles.onboardingData,
        })
        .from(profiles)
        .where(
          and(
            eq(profiles.notifyMarketing, true),
            eq(profiles.isActive, true),
            isNull(profiles.zohoCampaignsContactKey),
          ),
        )
        .limit(BATCH_SIZE);
    });

    let synced = 0;
    let failed = 0;

    for (const profile of unsyncedProfiles) {
      const result = await step.run(`process-${profile.id}`, async () => {
        try {
          const onboarding = (profile.onboardingData ?? {}) as Record<string, unknown>;
          const interests = Array.isArray(onboarding.interests)
            ? (onboarding.interests as string[]).join(", ")
            : undefined;
          const birthday =
            typeof onboarding.birthday === "string" && onboarding.birthday.trim()
              ? onboarding.birthday
              : undefined;

          await syncCampaignsSubscriber({
            profileId: profile.id,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName || undefined,
            isVip: profile.isVip,
            source: profile.source ?? undefined,
            tags: profile.tags ?? undefined,
            interests,
            birthday,
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

    return { found: unsyncedProfiles.length, synced, failed };
  },
);
