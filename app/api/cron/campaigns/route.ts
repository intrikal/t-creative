/**
 * GET /api/cron/campaigns — Batch sync subscribers to Zoho Campaigns.
 *
 * Finds all profiles with notifyMarketing=true that haven't been synced
 * to Zoho Campaigns yet (no zohoCampaignsContactKey) and syncs them.
 *
 * Run weekly via pg_cron or on-demand. Secured with CRON_SECRET header.
 */
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { syncCampaignsSubscriber, isZohoCampaignsConfigured } from "@/lib/zoho-campaigns";

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isZohoCampaignsConfigured()) {
    return NextResponse.json({ message: "Zoho Campaigns not configured, skipping" });
  }

  // Find opted-in, active profiles not yet synced to Campaigns
  const unsyncedProfiles = await db
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

  let synced = 0;
  let failed = 0;

  for (const profile of unsyncedProfiles) {
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
      synced++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    found: unsyncedProfiles.length,
    synced,
    failed,
  });
}
