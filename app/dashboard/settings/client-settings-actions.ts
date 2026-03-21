/**
 * client-settings-actions — Server actions for the client-facing Settings page.
 *
 * Clients (not admins) manage their own profile, notification preferences,
 * beauty preferences (lash style, allergies, etc.), and account deletion.
 *
 * Auth is per-user (getUser) not admin-gated — each client can only
 * read/write their own row.
 *
 * ## Allergy handling
 * Allergies are stored in the JSONB `onboardingData` column as a structured
 * object `{ adhesive: bool, latex: bool, nickel: bool, fragrances: bool, none: bool, notes: string }`.
 * The query deserializes this to a comma-separated display string; the mutation
 * parses it back. This roundtrip is needed because the client form uses a
 * simple text field, not individual checkboxes.
 *
 * ## CCPA "Right to Delete"
 * `deleteClientAccount()` implements California's data deletion requirements:
 * anonymizes the profile, deletes non-financial records, retains bookings/payments
 * for tax compliance, and purges the Supabase auth user.
 *
 * @see {@link ./components/ClientSettingsPage.tsx} — client settings UI
 * @see {@link db/schema/client-preferences.ts} — preferences table
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  profiles,
  clientPreferences,
  formSubmissions,
  loyaltyTransactions,
  notifications,
  reviews,
  serviceRecords,
  threads,
  waitlist,
  wishlistItems,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import { trackEvent } from "@/lib/posthog";
import { syncCampaignsSubscriber, unsubscribeFromCampaigns } from "@/lib/zoho-campaigns";
import { getUser } from "@/lib/auth";

const PATH = "/dashboard/settings";

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

export type ClientPreferences = {
  preferredLashStyle: string | null;
  preferredCurlType: string | null;
  preferredLengths: string | null;
  preferredDiameter: string | null;
  naturalLashNotes: string | null;
  retentionProfile: string | null;
  allergies: string | null;
  skinType: string | null;
  adhesiveSensitivity: boolean;
  healthNotes: string | null;
  birthday: string | null;
  preferredContactMethod: string | null;
  preferredServiceTypes: string | null;
  generalNotes: string | null;
  preferredRebookIntervalDays: number | null;
};

export type ClientSettingsData = {
  profile: ClientProfile;
  notifications: ClientNotifications;
  preferences: ClientPreferences | null;
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch the logged-in client's profile, notification prefs, and beauty preferences.
 *
 * Two parallel queries via Promise.all (no dependency between them):
 * 1. SELECT from profiles — basic contact info + notification booleans + onboardingData JSONB
 * 2. SELECT from client_preferences — lash/beauty preferences (separate 1:1 table)
 *
 * Allergies live inside the `onboardingData` JSONB blob, not a dedicated column,
 * because they were collected during onboarding and never needed SQL filtering.
 */
export async function getClientSettings(): Promise<ClientSettingsData> {
  try {
    const user = await getUser();

    // Promise.all runs profile and preferences queries in parallel — they have
    // no data dependency. Destructuring extracts the first row from each result
    // since both queries return at most one row (LIMIT 1 / unique profileId).
    const [[row], [prefRow]] = await Promise.all([
      db
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
        .limit(1),
      db.select().from(clientPreferences).where(eq(clientPreferences.profileId, user.id)).limit(1),
    ]);

    const onboarding = (row?.onboardingData ?? {}) as Record<string, unknown>;

    // allergies is stored as { adhesive: bool, latex: bool, nickel: bool, fragrances: bool, none: bool, notes: string }
    let allergies = "";
    if (onboarding.allergies && typeof onboarding.allergies === "object") {
      const a = onboarding.allergies as Record<string, unknown>;
      // .filter() keeps only allergy flags that are truthy (enabled), then .map()
      // capitalizes each flag name for display (e.g. "adhesive" → "Adhesive").
      const flags = ["adhesive", "latex", "nickel", "fragrances"]
        .filter((k) => a[k])
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
      const notes = (a.notes as string) ?? "";
      // Spread operator merges the flag names and free-text notes into a single
      // array, then .filter(Boolean) strips empty notes before .join(", ").
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
      preferences: prefRow
        ? {
            preferredLashStyle: prefRow.preferredLashStyle,
            preferredCurlType: prefRow.preferredCurlType,
            preferredLengths: prefRow.preferredLengths,
            preferredDiameter: prefRow.preferredDiameter,
            naturalLashNotes: prefRow.naturalLashNotes,
            retentionProfile: prefRow.retentionProfile,
            allergies: prefRow.allergies,
            skinType: prefRow.skinType,
            adhesiveSensitivity: prefRow.adhesiveSensitivity,
            healthNotes: prefRow.healthNotes,
            birthday: prefRow.birthday,
            preferredContactMethod: prefRow.preferredContactMethod,
            preferredServiceTypes: prefRow.preferredServiceTypes,
            generalNotes: prefRow.generalNotes,
            preferredRebookIntervalDays: prefRow.preferredRebookIntervalDays,
          }
        : null,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Profile mutation                                                   */
/* ------------------------------------------------------------------ */

const clientProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string(),
  allergies: z.string(),
});

/**
 * Update the client's basic profile (name, phone, allergies).
 * Email is NOT editable here — changing email requires Supabase auth flow.
 * Allergies are parsed from comma-separated text back into the structured
 * JSONB format, preserving other onboardingData fields via spread.
 */
export async function saveClientProfile(data: {
  firstName: string;
  lastName: string;
  phone: string;
  allergies: string;
}) {
  try {
    clientProfileSchema.parse(data);
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
    // Object.fromEntries + .map() builds { adhesive: bool, latex: bool, ... } by
    // checking if each known flag appears in the input text. Using Object.fromEntries
    // instead of a for-loop because the result is a plain Record consumed by JSONB.
    const flagValues = Object.fromEntries(allergyFlags.map((f) => [f, allergyText.includes(f)]));
    const knownFlags = new Set(allergyFlags);
    // Split → .map(trim) → .filter() extracts free-text notes by removing any tokens
    // that match known allergy flag names, then rejoin the remainder as a comma string.
    const notes = data.allergies
      .split(",")
      .map((s) => s.trim())
      .filter((s) => !knownFlags.has(s.toLowerCase()))
      .join(", ");

    // Spread flagValues into the allergy object, then add the computed `none`
    // flag (.some() checks if any known allergy is present) and freeform notes.
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
        // Spread operator shallow-merges the updated allergies into the existing
        // onboardingData JSONB without losing other fields (e.g. interests, birthday).
        onboardingData: { ...currentOnboarding, allergies: allergiesObj },
      })
      .where(eq(profiles.id, user.id));

    trackEvent(user.id, "client_profile_updated");

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Notifications mutation                                             */
/* ------------------------------------------------------------------ */

const clientNotificationsSchema = z.object({
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
  notifyMarketing: z.boolean(),
});

/**
 * Update notification preferences. When marketing is toggled ON, syncs the
 * client to Zoho Campaigns mailing list. When toggled OFF, unsubscribes them.
 */
export async function saveClientNotifications(prefs: ClientNotifications) {
  try {
    clientNotificationsSchema.parse(prefs);
    const user = await getUser();

    await db
      .update(profiles)
      .set({
        notifySms: prefs.notifySms,
        notifyEmail: prefs.notifyEmail,
        notifyMarketing: prefs.notifyMarketing,
      })
      .where(eq(profiles.id, user.id));

    trackEvent(user.id, "client_notifications_updated", {
      notifySms: prefs.notifySms,
      notifyEmail: prefs.notifyEmail,
      notifyMarketing: prefs.notifyMarketing,
    });

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
        // Ternary checks if interests is an array (it's stored as JSONB, could be
        // any type), then .join(", ") flattens it to a comma string for Zoho Campaigns.
        const interests = Array.isArray(onboarding.interests)
          ? (onboarding.interests as string[]).join(", ")
          : undefined;
        // Ternary validates that birthday is a non-empty string before passing to
        // Zoho — JSONB fields may be null, missing, or an empty string.
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Preferences mutation                                               */
/* ------------------------------------------------------------------ */

const clientPreferencesSchema = z.object({
  preferredLashStyle: z.string().nullable(),
  preferredCurlType: z.string().nullable(),
  preferredLengths: z.string().nullable(),
  preferredDiameter: z.string().nullable(),
  naturalLashNotes: z.string().nullable(),
  retentionProfile: z.string().nullable(),
  allergies: z.string().nullable(),
  skinType: z.string().nullable(),
  adhesiveSensitivity: z.boolean(),
  healthNotes: z.string().nullable(),
  birthday: z.string().nullable(),
  preferredContactMethod: z.string().nullable(),
  preferredServiceTypes: z.string().nullable(),
  generalNotes: z.string().nullable(),
  preferredRebookIntervalDays: z.number().int().positive().nullable(),
});

/**
 * Upsert beauty/service preferences. Uses INSERT ... ON CONFLICT DO UPDATE
 * (Postgres upsert) keyed on profileId — creates the row on first save,
 * updates in-place on subsequent saves. This avoids a separate "check if
 * exists" query.
 */
export async function saveClientPreferences(prefs: Omit<ClientPreferences, never>): Promise<void> {
  try {
    clientPreferencesSchema.parse(prefs);
    const user = await getUser();

    const values = {
      profileId: user.id,
      preferredLashStyle: prefs.preferredLashStyle,
      preferredCurlType: prefs.preferredCurlType,
      preferredLengths: prefs.preferredLengths,
      preferredDiameter: prefs.preferredDiameter,
      naturalLashNotes: prefs.naturalLashNotes,
      retentionProfile: prefs.retentionProfile,
      allergies: prefs.allergies,
      skinType: prefs.skinType,
      adhesiveSensitivity: prefs.adhesiveSensitivity,
      healthNotes: prefs.healthNotes,
      birthday: prefs.birthday,
      preferredContactMethod: prefs.preferredContactMethod,
      preferredServiceTypes: prefs.preferredServiceTypes,
      generalNotes: prefs.generalNotes,
      preferredRebookIntervalDays: prefs.preferredRebookIntervalDays,
    };

    await db
      .insert(clientPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: clientPreferences.profileId,
        set: {
          preferredLashStyle: values.preferredLashStyle,
          preferredCurlType: values.preferredCurlType,
          preferredLengths: values.preferredLengths,
          preferredDiameter: values.preferredDiameter,
          naturalLashNotes: values.naturalLashNotes,
          retentionProfile: values.retentionProfile,
          allergies: values.allergies,
          skinType: values.skinType,
          adhesiveSensitivity: values.adhesiveSensitivity,
          healthNotes: values.healthNotes,
          birthday: values.birthday,
          preferredContactMethod: values.preferredContactMethod,
          preferredServiceTypes: values.preferredServiceTypes,
          generalNotes: values.generalNotes,
          preferredRebookIntervalDays: values.preferredRebookIntervalDays,
        },
      });

    trackEvent(user.id, "client_preferences_updated");

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Delete account (CCPA-compliant)                                    */
/* ------------------------------------------------------------------ */

/**
 * Permanently delete a client's account and anonymize all personal data.
 *
 * CCPA "Right to Delete" implementation:
 * - Anonymizes the profile row (name, email, phone, notes, etc.)
 * - Deletes cascade-eligible child records (preferences, loyalty, reviews,
 *   form submissions, service records, notifications, threads, waitlist, wishlist)
 * - Retains anonymized bookings, payments, invoices, and orders for tax/financial compliance
 * - Deletes the Supabase auth user so the person can no longer sign in
 * - Audit-logs the deletion for compliance records
 */
export async function deleteClientAccount() {
  try {
    const user = await getUser();

    trackEvent(user.id, "account_deleted");

    // Promise.all deletes 9 independent tables in parallel — none depend on each
    // other and all use simple WHERE on the client's ID. Parallel execution
    // minimizes total deletion time for CCPA compliance response deadlines.
    await Promise.all([
      db.delete(clientPreferences).where(eq(clientPreferences.profileId, user.id)),
      db.delete(loyaltyTransactions).where(eq(loyaltyTransactions.profileId, user.id)),
      db.delete(notifications).where(eq(notifications.profileId, user.id)),
      db.delete(reviews).where(eq(reviews.clientId, user.id)),
      db.delete(formSubmissions).where(eq(formSubmissions.clientId, user.id)),
      db.delete(serviceRecords).where(eq(serviceRecords.clientId, user.id)),
      db.delete(threads).where(eq(threads.clientId, user.id)), // cascades to messages
      db.delete(waitlist).where(eq(waitlist.clientId, user.id)),
      db.delete(wishlistItems).where(eq(wishlistItems.clientId, user.id)),
    ]);

    // 2. Anonymize the profile (can't delete row — bookings/payments/invoices/orders
    //    have RESTRICT foreign keys, and financial records must be retained for tax compliance)
    const deletedId = user.id.slice(0, 8);
    await db
      .update(profiles)
      .set({
        firstName: "Deleted",
        lastName: "User",
        email: `deleted-${deletedId}@removed.invalid`,
        phone: null,
        displayName: null,
        avatarUrl: null,
        internalNotes: null,
        tags: null,
        lifecycleStage: null,
        source: null,
        eventSourceName: null,
        referralCode: null,
        squareCustomerId: null,
        zohoContactId: null,
        zohoCampaignsContactKey: null,
        zohoCustomerId: null,
        onboardingData: null,
        notifySms: false,
        notifyEmail: false,
        notifyMarketing: false,
        isActive: false,
      })
      .where(eq(profiles.id, user.id));

    // 3. Audit log (immutable — retained for compliance)
    await logAction({
      actorId: user.id,
      action: "delete",
      entityType: "client_account",
      entityId: user.id,
      description: "Client account deleted and personal data anonymized (CCPA)",
    });

    // 4. Delete the Supabase auth user so credentials are purged
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminClient = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { persistSession: false } },
      );
      await adminClient.auth.admin.deleteUser(user.id);
    } else {
      // Fallback: sign out only (auth user remains but profile is anonymized)
      const { createClient } = await import("@/utils/supabase/server");
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
