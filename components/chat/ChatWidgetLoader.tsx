/**
 * ChatWidgetLoader — Server Component wrapper for ChatWidget.
 *
 * Fetches the admin profile and active services, then renders the client-side
 * ChatWidget with the data it needs. Safe to drop into any Server Component
 * (landing page, etc.) without prop-drilling.
 */
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { Studio } from "@/components/booking/types";
import { db } from "@/db";
import { profiles, services } from "@/db/schema";
import { ChatWidget } from "./ChatWidget";

export async function ChatWidgetLoader() {
  const [admin] = await db
    .select({ onboardingData: profiles.onboardingData, firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  if (!admin?.onboardingData) return null;

  const data = admin.onboardingData as Record<string, unknown>;

  // Derive slug the same way as app/book/[slug]/page.tsx
  const studioName = (data.studioName as string | undefined) ?? "";
  const slug = studioName.toLowerCase().replace(/\s+/g, "");

  const activeServices = await db
    .select({
      id: services.id,
      category: services.category,
      name: services.name,
      priceInCents: services.priceInCents,
      depositInCents: services.depositInCents,
      durationMinutes: services.durationMinutes,
      description: services.description,
    })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(services.sortOrder);

  const location = data.location as Record<string, string> | undefined;
  const socials = data.socials as Record<string, string> | undefined;
  const schedule = data.schedule as Record<string, string | null> | undefined;
  const policiesRaw = data.policies as Record<string, unknown> | undefined;
  const intake =
    (data.intake as
      | Record<string, { prep: string; questions: Record<string, boolean> }>
      | undefined) ?? {};

  const studio: Studio = {
    name: studioName || "T Creative Studio",
    bio: (data.bio as string | undefined) ?? "",
    locationType: location?.type ?? "home_studio",
    locationArea: location?.area ?? "",
    socials: {
      instagram: socials?.instagram ?? "",
      instagram2: socials?.instagram2 ?? "",
      instagram3: socials?.instagram3 ?? "",
      instagram4: socials?.instagram4 ?? "",
      tiktok: socials?.tiktok ?? "",
      facebook: socials?.facebook ?? "",
    },
    avatarUrl: null,
    firstName: admin.firstName ?? "",
    policies: {
      cancellationWindowHours: (policiesRaw?.cancellationWindowHours as number | null) ?? null,
      cancellationFeeInCents: (policiesRaw?.cancellationFeeInCents as number | null) ?? null,
      noShowFeeInCents: (policiesRaw?.noShowFeeInCents as number | null) ?? null,
      bookingConfirmation: (policiesRaw?.bookingConfirmation as string | undefined) ?? "manual",
    },
    intake,
    rewardsEnabled: (data.rewardsEnabled as boolean | undefined) ?? false,
    waitlist: (data.waitlist as Record<string, boolean | string> | undefined) ?? {},
    schedule: {
      startTime: schedule?.startTime ?? null,
      endTime: schedule?.endTime ?? null,
    },
  };

  return (
    <ChatWidget
      studio={studio}
      services={activeServices}
      slug={slug}
      bookingPageUrl={`/book/${slug}`}
    />
  );
}
