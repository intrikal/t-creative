"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { syncCampaignsSubscriber, unsubscribeFromCampaigns } from "@/lib/zoho-campaigns";
import { createClient } from "@/utils/supabase/server";

const PATH = "/dashboard/settings";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ClientProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  allergies: string;
};

export type ClientNotifications = {
  notifySms: boolean;
  notifyEmail: boolean;
  notifyMarketing: boolean;
};

export type ClientSettingsData = {
  profile: ClientProfile;
  notifications: ClientNotifications;
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientSettings(): Promise<ClientSettingsData> {
  const user = await getUser();

  const [row] = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      onboardingData: profiles.onboardingData,
      notifySms: profiles.notifySms,
      notifyEmail: profiles.notifyEmail,
      notifyMarketing: profiles.notifyMarketing,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const onboarding = (row?.onboardingData ?? {}) as Record<string, unknown>;

  // allergies is stored as { adhesive: bool, latex: bool, nickel: bool, fragrances: bool, none: bool, notes: string }
  let allergies = "";
  if (onboarding.allergies && typeof onboarding.allergies === "object") {
    const a = onboarding.allergies as Record<string, unknown>;
    const flags = ["adhesive", "latex", "nickel", "fragrances"]
      .filter((k) => a[k])
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
    const notes = (a.notes as string) ?? "";
    allergies = [...flags, notes].filter(Boolean).join(", ");
  } else if (typeof onboarding.allergies === "string") {
    allergies = onboarding.allergies;
  }

  return {
    profile: {
      firstName: row?.firstName ?? "",
      lastName: row?.lastName ?? "",
      email: row?.email ?? "",
      phone: row?.phone ?? "",
      allergies,
    },
    notifications: {
      notifySms: row?.notifySms ?? true,
      notifyEmail: row?.notifyEmail ?? true,
      notifyMarketing: row?.notifyMarketing ?? false,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Profile mutation                                                   */
/* ------------------------------------------------------------------ */

export async function saveClientProfile(data: {
  firstName: string;
  lastName: string;
  phone: string;
  allergies: string;
}) {
  const user = await getUser();

  const [existing] = await db
    .select({ onboardingData: profiles.onboardingData })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const currentOnboarding = (existing?.onboardingData ?? {}) as Record<string, unknown>;

  // Parse the comma-separated allergies string back into the structured object
  const allergyText = data.allergies.toLowerCase();
  const allergyFlags = ["adhesive", "latex", "nickel", "fragrances"];
  const flagValues = Object.fromEntries(allergyFlags.map((f) => [f, allergyText.includes(f)]));
  const knownFlags = new Set(allergyFlags);
  const notes = data.allergies
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !knownFlags.has(s.toLowerCase()))
    .join(", ");

  const allergiesObj = {
    ...flagValues,
    none: !allergyFlags.some((f) => allergyText.includes(f)) && !notes,
    notes,
  };

  await db
    .update(profiles)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      onboardingData: { ...currentOnboarding, allergies: allergiesObj },
    })
    .where(eq(profiles.id, user.id));

  revalidatePath(PATH);
}

/* ------------------------------------------------------------------ */
/*  Notifications mutation                                             */
/* ------------------------------------------------------------------ */

export async function saveClientNotifications(prefs: ClientNotifications) {
  const user = await getUser();

  await db
    .update(profiles)
    .set({
      notifySms: prefs.notifySms,
      notifyEmail: prefs.notifyEmail,
      notifyMarketing: prefs.notifyMarketing,
    })
    .where(eq(profiles.id, user.id));

  // Zoho Campaigns: sync or unsub based on marketing preference
  if (prefs.notifyMarketing) {
    const [profile] = await db
      .select({
        email: profiles.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        isVip: profiles.isVip,
        source: profiles.source,
        tags: profiles.tags,
        onboardingData: profiles.onboardingData,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (profile) {
      const onboarding = (profile.onboardingData ?? {}) as Record<string, unknown>;
      const interests = Array.isArray(onboarding.interests)
        ? (onboarding.interests as string[]).join(", ")
        : undefined;
      const birthday =
        typeof onboarding.birthday === "string" && onboarding.birthday.trim()
          ? onboarding.birthday
          : undefined;

      syncCampaignsSubscriber({
        profileId: user.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName || undefined,
        isVip: profile.isVip,
        source: profile.source ?? undefined,
        tags: profile.tags ?? undefined,
        interests,
        birthday,
      });
    }
  } else {
    unsubscribeFromCampaigns(user.id);
  }

  revalidatePath(PATH);
}
