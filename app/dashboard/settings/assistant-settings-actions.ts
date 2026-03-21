/**
 * Server actions for the Assistant Settings page.
 *
 * Assistants (staff members, not the studio admin) manage their own
 * profile, weekly availability, notification preferences, and time-off
 * requests through this module.
 *
 * ## Auth model
 * Uses `getUser()` (not `requireAdmin()`) so each assistant can only
 * read/write their own data. The user ID from the session gates every query.
 *
 * ## Data layout
 * - Profile fields → `profiles` + `assistant_profiles` tables
 * - Weekly availability → `business_hours` rows keyed by `staff_id`
 * - Notification prefs → `settings` table under key `assistant_notif:{userId}`
 * - Time-off requests → `time_off` rows keyed by `staff_id`, with JSON metadata
 *   in the `notes` column for status tracking (pending/approved/denied)
 *
 * ## Availability save strategy
 * Same delete-and-reinsert pattern as `hours-actions.ts`, scoped to the
 * staff member's own rows.
 *
 * @module settings/assistant-settings-actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles, assistantProfiles, businessHours, timeOff, settings } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";

const PATH = "/dashboard/settings";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AssistantProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  bio: string;
  instagram: string;
};

export type DayAvailability = {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

export type NotificationPrefs = {
  newBooking: boolean;
  bookingReminder: boolean;
  cancellation: boolean;
  messageFromTrini: boolean;
  trainingDue: boolean;
  payoutProcessed: boolean;
  weeklyDigest: boolean;
};

export type TimeOffRequest = {
  id: number;
  from: string;
  to: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  submittedOn: string;
};

export type AssistantSettingsData = {
  profile: AssistantProfile;
  availability: DayAvailability[];
  notifications: NotificationPrefs;
  timeOffRequests: TimeOffRequest[];
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  newBooking: true,
  bookingReminder: true,
  cancellation: true,
  messageFromTrini: true,
  trainingDue: true,
  payoutProcessed: true,
  weeklyDigest: false,
};

const DEFAULT_AVAILABILITY: DayAvailability[] = [
  { dayOfWeek: 1, isOpen: true, opensAt: "10:00", closesAt: "18:00" },
  { dayOfWeek: 2, isOpen: true, opensAt: "10:00", closesAt: "18:00" },
  { dayOfWeek: 3, isOpen: true, opensAt: "10:00", closesAt: "18:00" },
  { dayOfWeek: 4, isOpen: true, opensAt: "10:00", closesAt: "19:00" },
  { dayOfWeek: 5, isOpen: true, opensAt: "10:00", closesAt: "19:00" },
  { dayOfWeek: 6, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
  { dayOfWeek: 7, isOpen: false, opensAt: null, closesAt: null },
];

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getAssistantSettings(): Promise<AssistantSettingsData> {
  const user = await getUser();

  // 1. Profile data
  const [profileRow] = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      phone: profiles.phone,
      email: profiles.email,
      onboardingData: profiles.onboardingData,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  let bio = "";
  try {
    const [assistantRow] = await db
      .select({ bio: assistantProfiles.bio })
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, user.id))
      .limit(1);
    bio = assistantRow?.bio ?? "";
  } catch {
    // assistant_profiles may not exist for this user
  }

  const onboarding = (profileRow?.onboardingData ?? {}) as Record<string, unknown>;
  const instagram = (onboarding.instagram as string) ?? "";

  const profile: AssistantProfile = {
    firstName: profileRow?.firstName ?? "",
    lastName: profileRow?.lastName ?? "",
    phone: profileRow?.phone ?? "",
    email: profileRow?.email ?? "",
    bio,
    instagram,
  };

  // 2. Availability (per-staff business hours)
  let availabilityRows = await db
    .select({
      dayOfWeek: businessHours.dayOfWeek,
      isOpen: businessHours.isOpen,
      opensAt: businessHours.opensAt,
      closesAt: businessHours.closesAt,
    })
    .from(businessHours)
    .where(eq(businessHours.staffId, user.id));

  if (availabilityRows.length === 0) {
    // Seed from defaults
    await db.insert(businessHours).values(
      DEFAULT_AVAILABILITY.map((d) => ({
        staffId: user.id,
        dayOfWeek: d.dayOfWeek,
        isOpen: d.isOpen,
        opensAt: d.opensAt,
        closesAt: d.closesAt,
      })),
    );
    availabilityRows = DEFAULT_AVAILABILITY;
  }

  const availability: DayAvailability[] = availabilityRows
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((r) => ({
      dayOfWeek: r.dayOfWeek,
      isOpen: r.isOpen,
      opensAt: r.opensAt,
      closesAt: r.closesAt,
    }));

  // 3. Notification prefs
  const notifKey = `assistant_notif:${user.id}`;
  const [notifRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, notifKey));

  const notifications: NotificationPrefs = notifRow
    ? { ...DEFAULT_NOTIFICATIONS, ...(notifRow.value as Partial<NotificationPrefs>) }
    : DEFAULT_NOTIFICATIONS;

  // 4. Time off requests
  const timeOffRows = await db
    .select({
      id: timeOff.id,
      startDate: timeOff.startDate,
      endDate: timeOff.endDate,
      label: timeOff.label,
      notes: timeOff.notes,
      createdAt: timeOff.createdAt,
    })
    .from(timeOff)
    .where(eq(timeOff.staffId, user.id))
    .orderBy(desc(timeOff.createdAt));

  const timeOffRequests: TimeOffRequest[] = timeOffRows.map((r) => {
    let status: "pending" | "approved" | "denied" = "pending";
    let reason = r.label ?? "";

    if (r.notes) {
      try {
        const meta = JSON.parse(r.notes) as { status?: string; reason?: string };
        if (meta.status === "approved") status = "approved";
        else if (meta.status === "denied") status = "denied";
        if (meta.reason) reason = meta.reason;
      } catch {
        // notes is plain text, use label as reason
      }
    }

    return {
      id: r.id,
      from: r.startDate,
      to: r.endDate,
      reason,
      status,
      submittedOn: new Date(r.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    };
  });

  return { profile, availability, notifications, timeOffRequests };
}

/* ------------------------------------------------------------------ */
/*  Profile mutation                                                   */
/* ------------------------------------------------------------------ */

const assistantProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string(),
  bio: z.string(),
  instagram: z.string(),
});

export async function saveAssistantProfile(data: {
  firstName: string;
  lastName: string;
  phone: string;
  bio: string;
  instagram: string;
}) {
  assistantProfileSchema.parse(data);
  const user = await getUser();

  // Update profiles table
  const [existing] = await db
    .select({ onboardingData: profiles.onboardingData })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const currentOnboarding = (existing?.onboardingData ?? {}) as Record<string, unknown>;

  await db
    .update(profiles)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      onboardingData: { ...currentOnboarding, instagram: data.instagram },
    })
    .where(eq(profiles.id, user.id));

  // Update assistant bio
  try {
    const [assistantExists] = await db
      .select({ profileId: assistantProfiles.profileId })
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, user.id))
      .limit(1);

    if (assistantExists) {
      await db
        .update(assistantProfiles)
        .set({ bio: data.bio || null })
        .where(eq(assistantProfiles.profileId, user.id));
    }
  } catch {
    // assistant_profiles table may not have been pushed yet
  }

  revalidatePath(PATH);
  trackEvent(user.id, "assistant_profile_updated");
}

/* ------------------------------------------------------------------ */
/*  Availability mutation                                              */
/* ------------------------------------------------------------------ */

const dayAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  isOpen: z.boolean(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
});

export async function saveAssistantAvailability(days: DayAvailability[]) {
  z.array(dayAvailabilitySchema).parse(days);
  const user = await getUser();

  await db.transaction(async (tx) => {
    await tx.delete(businessHours).where(eq(businessHours.staffId, user.id));
    await tx.insert(businessHours).values(
      days.map((d) => ({
        staffId: user.id,
        dayOfWeek: d.dayOfWeek,
        isOpen: d.isOpen,
        opensAt: d.opensAt,
        closesAt: d.closesAt,
      })),
    );
  });

  revalidatePath(PATH);
  trackEvent(user.id, "assistant_availability_updated");
}

/* ------------------------------------------------------------------ */
/*  Notifications mutation                                             */
/* ------------------------------------------------------------------ */

const assistantNotificationsSchema = z.object({
  newBooking: z.boolean(),
  bookingReminder: z.boolean(),
  cancellation: z.boolean(),
  messageFromTrini: z.boolean(),
  trainingDue: z.boolean(),
  payoutProcessed: z.boolean(),
  weeklyDigest: z.boolean(),
});

export async function saveAssistantNotifications(prefs: NotificationPrefs) {
  assistantNotificationsSchema.parse(prefs);
  const user = await getUser();
  const notifKey = `assistant_notif:${user.id}`;

  await db
    .insert(settings)
    .values({
      key: notifKey,
      label: "Assistant Notification Preferences",
      description: `Notification preferences for assistant ${user.id}`,
      value: prefs,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: prefs },
    });

  revalidatePath(PATH);
}

/* ------------------------------------------------------------------ */
/*  Time off mutation                                                  */
/* ------------------------------------------------------------------ */

const timeOffRequestSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string(),
  requestType: z.enum(["full_day", "partial"]).default("full_day"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export async function submitTimeOffRequest(data: {
  from: string;
  to: string;
  reason: string;
  requestType?: "full_day" | "partial";
  startTime?: string;
  endTime?: string;
}) {
  timeOffRequestSchema.parse(data);
  const user = await getUser();

  const requestType = data.requestType ?? "full_day";
  const isPartial = requestType === "partial";
  const partial =
    isPartial && data.startTime && data.endTime
      ? { startTime: data.startTime, endTime: data.endTime }
      : false;

  await db.insert(timeOff).values({
    staffId: user.id,
    // Partial day and single-day full day use "day_off"; multi-day full day uses "vacation"
    type: !isPartial && data.from !== data.to ? "vacation" : "day_off",
    startDate: data.from,
    endDate: data.to || data.from,
    label: data.reason || "Time off request",
    notes: JSON.stringify({
      status: "pending",
      reason: data.reason || "No reason provided",
      partial,
    }),
  });

  trackEvent(user.id, "time_off_requested", { from: data.from, to: data.to, requestType });
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}
