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

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  profiles,
  clientPreferences,
  formSubmissions,
  loyaltyTransactions,
  membershipSubscriptions,
  mediaItems,
  notifications,
  reviews,
  serviceRecords,
  threads,
  waitlist,
  wishlistItems,
} from "@/db/schema";
import type { NotifChannel, NotifType } from "@/db/schema";
import { DataDeletionConfirmation } from "@/emails/DataDeletionConfirmation";
import { logAction } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  getNotificationPreferences,
  setNotificationPreference,
} from "@/lib/notification-preferences";
import { trackEvent } from "@/lib/posthog";
import { redis } from "@/lib/redis";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { isSquareConfigured, squareClient } from "@/lib/square";
import { syncCampaignsSubscriber, unsubscribeFromCampaigns } from "@/lib/zoho-campaigns";
import { createClient } from "@/utils/supabase/server";

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
  birthday: string;
  preferredContactMethod: string;
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
  notifications: Record<string, boolean>;
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
        birthday: prefRow?.birthday ?? "",
        preferredContactMethod: prefRow?.preferredContactMethod ?? "",
      },
      notifications: await getClientNotificationPrefs(),
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
/*  My Profile mutation (name, phone, email, birthday, contact pref)  */
/* ------------------------------------------------------------------ */

/**
 * E.164 phone format: optional +, 1–15 digits.
 * Accepts empty string (phone is optional).
 */
const E164_REGEX = /^\+?[1-9]\d{1,14}$/;

const updateClientProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s\-().]/g, ""))
    .refine((v) => v === "" || E164_REGEX.test(v), {
      message: "Phone must be a valid number (e.g. +12125551234)",
    }),
  email: z.string().email("Enter a valid email address"),
  birthday: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Birthday must be a valid date (YYYY-MM-DD)",
    })
    .nullable(),
  preferredContactMethod: z.enum(["", "text", "email", "instagram DM", "phone call"]).nullable(),
});

export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;

export type UpdateClientProfileResult =
  | { success: true; emailChangePending: boolean }
  | { success: false; error: string };

/**
 * Update the client's My Profile section: name, phone, email, birthday,
 * and preferred contact method.
 *
 * ## Email change flow
 * Email is special — `profiles.email` must stay in sync with `auth.users.email`.
 * When the email changes we call `supabase.auth.updateUser({ email: newEmail })`
 * which sends a confirmation link to the new address. Supabase updates
 * `auth.users.email` only after the user clicks the link (and fires the
 * USER_UPDATED auth event). We do NOT write the new email to `profiles.email`
 * here — it is updated via the auth webhook / callback once confirmed.
 * The caller receives `{ emailChangePending: true }` so the UI can show a
 * "Check your inbox" banner.
 *
 * ## Phone change
 * Phone is updated immediately. We validate E.164 format so downstream
 * systems (Twilio SMS) can use it without further normalisation.
 *
 * ## RLS enforcement
 * `getUser()` throws if not authenticated. The WHERE clause on every
 * write is `eq(profiles.id, user.id)` — equivalent to RLS
 * `auth.uid() = profile_id`, enforced in application code.
 *
 * ## Audit log
 * Every call appends a row to `audit_log` with action="update",
 * entityType="profile", and a before/after diff in `metadata`.
 *
 * ## Square sync
 * If `squareCustomerId` is set and Square is configured, the customer
 * record is updated to match the new name and phone.
 */
export async function updateClientProfile(
  data: UpdateClientProfileInput,
): Promise<UpdateClientProfileResult> {
  try {
    const parsed = updateClientProfileSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { firstName, lastName, phone, email, birthday, preferredContactMethod } = parsed.data;

    const user = await getUser();

    // Fetch current profile to diff and to get squareCustomerId
    const [current] = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        phone: profiles.phone,
        squareCustomerId: profiles.squareCustomerId,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!current) throw new Error("Profile not found");

    const emailChanged = email.toLowerCase() !== current.email.toLowerCase();
    let emailChangePending = false;

    // ── Email change: trigger Supabase auth flow, do NOT write to profiles ──
    if (emailChanged) {
      const supabase = await createClient();
      const { error: authError } = await supabase.auth.updateUser({ email });
      if (authError) {
        return { success: false, error: authError.message };
      }
      emailChangePending = true;
      // profiles.email is intentionally NOT updated here — it will be updated
      // once the user confirms the new address via the Supabase auth webhook.
    }

    // ── Write name, phone to profiles ─────────────────────────────────────
    await db
      .update(profiles)
      .set({
        firstName,
        lastName,
        phone: phone || null,
      })
      .where(eq(profiles.id, user.id));

    // ── Write birthday + preferredContactMethod to client_preferences ──────
    await db
      .insert(clientPreferences)
      .values({
        profileId: user.id,
        birthday: birthday || null,
        preferredContactMethod: preferredContactMethod || null,
      })
      .onConflictDoUpdate({
        target: clientPreferences.profileId,
        set: {
          birthday: birthday || null,
          preferredContactMethod: preferredContactMethod || null,
        },
      });

    // ── Audit log ─────────────────────────────────────────────────────────
    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "profile",
      entityId: user.id,
      description: "Client updated their profile",
      metadata: {
        before: {
          firstName: current.firstName,
          lastName: current.lastName,
          phone: current.phone,
          email: current.email,
        },
        after: {
          firstName,
          lastName,
          phone: phone || null,
          // Record the intended new email; actual profiles.email only changes post-confirm
          email: emailChanged ? `${email} (pending confirmation)` : email,
        },
        emailChangePending,
      },
    });

    // ── Square customer sync (best-effort) ────────────────────────────────
    if (current.squareCustomerId && isSquareConfigured()) {
      try {
        await squareClient.customers.update({
          customerId: current.squareCustomerId,
          givenName: firstName,
          familyName: lastName || undefined,
          phoneNumber: phone || undefined,
        });
      } catch (squareErr) {
        // Non-fatal — local profile is already updated
        Sentry.captureException(squareErr);
      }
    }

    trackEvent(user.id, "client_profile_updated", { emailChangePending });

    revalidatePath(PATH);

    return { success: true, emailChangePending };
  } catch (err) {
    Sentry.captureException(err);
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "An unexpected error occurred" };
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
 * 1. Sends a final confirmation email BEFORE anonymizing (email will be purged)
 * 2. In a DB transaction:
 *    - Deletes cascade-eligible child records (preferences, loyalty, reviews,
 *      form submissions, service records, notifications, threads, waitlist,
 *      wishlist, media items)
 *    - Cancels active memberships
 *    - Anonymizes the profile row (name, email → hash, phone, birthday, notes)
 *    - Nullifies referral codes
 *    - Logs to audit_log with type 'ccpa_deletion_request'
 * 3. Deletes photos from Supabase Storage (best-effort, outside transaction)
 * 4. Deletes Square customer record (best-effort)
 * 5. Deletes the Supabase auth user so credentials are purged
 *
 * RETAINED for legal/tax compliance:
 * - Bookings (client_name shows "Deleted User")
 * - Payments, invoices, orders
 * - Webhook events, audit_log, sync_log
 */
export async function deleteClientAccount() {
  try {
    const user = await getUser();

    trackEvent(user.id, "account_deleted");

    // 1. Fetch profile data needed BEFORE anonymization (email for confirmation,
    //    squareCustomerId for external cleanup)
    const [profile] = await db
      .select({
        firstName: profiles.firstName,
        email: profiles.email,
        squareCustomerId: profiles.squareCustomerId,
        notifyEmail: profiles.notifyEmail,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    // 2. Collect media storage paths before deleting DB rows
    const clientMedia = await db
      .select({
        id: mediaItems.id,
        storagePath: mediaItems.storagePath,
        beforeStoragePath: mediaItems.beforeStoragePath,
      })
      .from(mediaItems)
      .where(eq(mediaItems.clientId, user.id));

    // 3. Send final confirmation email BEFORE anonymizing (last chance to reach them)
    if (profile?.email && isResendConfigured()) {
      await sendEmail({
        to: profile.email,
        subject: "Your data deletion request has been processed",
        react: <DataDeletionConfirmation clientName={profile.firstName || "there"} />,
        entityType: "ccpa_deletion_confirmation",
        localId: user.id,
      });
    }

    // 4. Database transaction — all-or-nothing deletion + anonymization
    const deletedId = user.id.slice(0, 8);

    await db.transaction(async (tx) => {
      // 4a. Delete cascade-eligible child records in parallel
      await Promise.all([
        tx.delete(clientPreferences).where(eq(clientPreferences.profileId, user.id)),
        tx.delete(loyaltyTransactions).where(eq(loyaltyTransactions.profileId, user.id)),
        tx.delete(notifications).where(eq(notifications.profileId, user.id)),
        tx.delete(reviews).where(eq(reviews.clientId, user.id)),
        tx.delete(formSubmissions).where(eq(formSubmissions.clientId, user.id)),
        tx.delete(serviceRecords).where(eq(serviceRecords.clientId, user.id)),
        tx.delete(threads).where(eq(threads.clientId, user.id)), // cascades to messages
        tx.delete(waitlist).where(eq(waitlist.clientId, user.id)),
        tx.delete(wishlistItems).where(eq(wishlistItems.clientId, user.id)),
        tx.delete(mediaItems).where(eq(mediaItems.clientId, user.id)),
      ]);

      // 4b. Cancel active memberships (entitlements only — billing is external)
      await tx
        .update(membershipSubscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          notes: "Auto-cancelled: CCPA data deletion request",
        })
        .where(
          and(
            eq(membershipSubscriptions.clientId, user.id),
            eq(membershipSubscriptions.status, "active"),
          ),
        );

      // 4c. Anonymize the profile (can't delete row — bookings/payments/invoices/orders
      //     have RESTRICT foreign keys, and financial records must be retained for tax compliance)
      await tx
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
    });

    // 5. Audit log — outside transaction since logAction is non-fatal and uses
    //    its own error handling. entityType 'ccpa_deletion_request' for admin filtering.
    await logAction({
      actorId: user.id,
      action: "delete",
      entityType: "ccpa_deletion_request",
      entityId: user.id,
      description: "Client account deleted and personal data anonymized (CCPA)",
      metadata: {
        email: profile?.email ?? "unknown",
        mediaItemsDeleted: clientMedia.length,
      },
    });

    // 6. Delete photos from Supabase Storage (best-effort, outside transaction)
    if (clientMedia.length > 0) {
      try {
        const supabase = await createClient();
        const pathsToDelete = clientMedia.flatMap(
          (m) => [m.storagePath, m.beforeStoragePath].filter(Boolean) as string[],
        );
        if (pathsToDelete.length > 0) {
          await supabase.storage.from("media").remove(pathsToDelete);
        }
      } catch (storageErr) {
        // Non-fatal — DB rows are already deleted, storage cleanup can be retried
        Sentry.captureException(storageErr);
      }
    }

    // 7. Delete Square customer record (best-effort)
    if (profile?.squareCustomerId && isSquareConfigured()) {
      try {
        await squareClient.customers.delete({ customerId: profile.squareCustomerId });
      } catch (squareErr) {
        // Non-fatal — profile is already anonymized
        Sentry.captureException(squareErr);
      }
    }

    // 8. Unsubscribe from Zoho Campaigns (best-effort)
    try {
      unsubscribeFromCampaigns(user.id);
    } catch {
      // Non-fatal
    }

    // 9. Invalidate the proxy profile cache so the ban-check fires immediately
    await redis.del(`profile:${user.id}`);

    // 10. Delete the Supabase auth user so credentials are purged
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminClient = createSupabaseAdmin(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
        auth: { persistSession: false },
      });
      await adminClient.auth.admin.deleteUser(user.id);
    } else {
      // Fallback: sign out only (auth user remains but profile is anonymized)
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Granular notification preferences                                  */
/* ------------------------------------------------------------------ */

const VALID_CHANNELS = ["email", "sms", "push"] as const;
const VALID_TYPES = [
  "booking_reminder",
  "review_request",
  "fill_reminder",
  "birthday_promo",
  "marketing",
] as const;

/**
 * Load all notification preferences for the current client.
 * Returns a Record keyed by `${channel}:${type}` → enabled.
 */
export async function getClientNotificationPrefs(): Promise<Record<string, boolean>> {
  const user = await getUser();
  const map = await getNotificationPreferences(user.id);
  const result: Record<string, boolean> = {};
  for (const ch of VALID_CHANNELS) {
    for (const t of VALID_TYPES) {
      result[`${ch}:${t}`] = map.get(`${ch}:${t}`) ?? true;
    }
  }
  return result;
}

/**
 * Save granular notification preferences from the settings UI.
 * Input is a Record keyed by `${channel}:${type}` → enabled.
 */
export async function saveNotificationPreferences(prefs: Record<string, boolean>): Promise<void> {
  try {
    const user = await getUser();

    for (const [key, enabled] of Object.entries(prefs)) {
      const [channel, ...typeParts] = key.split(":");
      const type = typeParts.join(":");

      if (
        VALID_CHANNELS.includes(channel as NotifChannel) &&
        VALID_TYPES.includes(type as NotifType)
      ) {
        await setNotificationPreference(
          user.id,
          channel as NotifChannel,
          type as NotifType,
          enabled,
        );
      }
    }

    // Sync the legacy profile booleans to stay consistent.
    // Email: enabled if any email type is on. SMS: same. Marketing: specific type.
    const emailEnabled = VALID_TYPES.some((t) => prefs[`email:${t}`] !== false);
    const smsEnabled = VALID_TYPES.some((t) => prefs[`sms:${t}`] !== false);
    const marketingEnabled = prefs["email:marketing"] ?? true;

    await db
      .update(profiles)
      .set({
        notifyEmail: emailEnabled,
        notifySms: smsEnabled,
        notifyMarketing: marketingEnabled,
      })
      .where(eq(profiles.id, user.id));

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
