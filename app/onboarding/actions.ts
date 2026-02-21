"use server";

/**
 * saveOnboardingData — Server Action to persist onboarding form data to the database.
 *
 * ## What is a Server Action?
 * The `"use server"` directive at the top of this file tells Next.js that the
 * functions exported here run ONLY on the server, never in the browser. The
 * client-side form (OnboardingFlow.tsx) calls `saveOnboardingData(...)` as if
 * it were a regular function, but Next.js secretly sends the call as a secure
 * POST request to the server. This means database credentials and sensitive
 * logic never reach the browser.
 *
 * ## Two roles, two paths
 * The same function handles both onboarding flows depending on the `role` arg:
 *
 * ### Client path
 * Saves everything into two places:
 * - `profiles` table: firstName, email, phone, source, notification prefs
 * - `profiles.onboarding_data` (JSONB): interests, allergies, availability,
 *   referral info, waiver agreement, photo consent, birthday
 *
 * ### Assistant path
 * Saves to THREE places:
 * - `profiles` table: firstName, email, phone, notification prefs
 * - `profiles.onboarding_data` (JSONB): shift availability, preferred shift time,
 *   max hours/week, emergency contact, experience level, certifications,
 *   work style, Instagram handle
 * - `assistant_profiles` table: professional display data (title, specialties, bio)
 *
 * ## Why use a JSONB column for some fields?
 * Fields like allergies and shift availability are complex nested objects that
 * don't need their own dedicated columns (no filtering, sorting, or joining on them).
 * Storing them in a JSONB column keeps the schema clean while still allowing
 * access to the full data when displaying a client's or assistant's profile.
 *
 * ## Why validate with a schema?
 * The `raw` argument arrives from the browser. Even though the onboarding form
 * has client-side validation, any data crossing the network boundary should be
 * re-validated on the server — a user could send a crafted request bypassing the
 * form entirely. Zod schemas (onboardingSchema / assistantOnboardingSchema) verify
 * the shape and types before anything touches the database.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { assistantProfiles } from "@/db/schema/assistants";
import {
  onboardingSchema,
  assistantOnboardingSchema,
  type OnboardingData,
  type AssistantOnboardingData,
} from "@/lib/onboarding-schema";
import { createClient } from "@/utils/supabase/server";

export async function saveOnboardingData(
  raw: OnboardingData | AssistantOnboardingData,
  role: "client" | "assistant" = "client",
) {
  /**
   * Verify the caller is authenticated using the server-side Supabase client
   * (reads the session from cookies, not from the browser).
   * We always call getUser() — not getSession() — because getUser() validates
   * the JWT against Supabase's servers and is safe for authorization checks.
   */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  if (role === "assistant") {
    /**
     * Run the assistant-specific Zod schema against the raw form data.
     * `.parse()` will throw a ZodError if any field is invalid, which
     * bubbles up as an error to the calling component.
     */
    const data = assistantOnboardingSchema.parse(raw);

    const {
      firstName,
      email,
      phone,
      instagramHandle,
      notifications,
      preferredTitle,
      skills,
      experienceLevel,
      bio,
      certifications,
      workStyle,
      shiftAvailability,
      preferredShiftTime,
      maxHoursPerWeek,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
    } = data;

    /**
     * Fields that go into the JSONB `onboarding_data` column.
     * These are assistant-specific operational details (schedule, emergency
     * contact, work preferences) that aren't queried directly in SQL,
     * so they don't need their own columns.
     */
    const onboardingData = {
      shiftAvailability, // { monday: bool, tuesday: bool, ... } — which days they can work
      preferredShiftTime, // "morning" | "afternoon" | "evening" | "flexible"
      maxHoursPerWeek, // optional number — their weekly hour cap
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      experienceLevel, // "junior" | "mid" | "senior"
      certifications: certifications ?? [], // array of certification IDs
      workStyle, // "client_facing" | "back_of_house" | "both"
      instagramHandle: instagramHandle || null,
    };

    // Step 1: Update the shared profiles row with identity and contact info
    await db
      .update(profiles)
      .set({
        firstName,
        email,
        phone: phone || null,
        notifySms: notifications.sms,
        notifyEmail: notifications.email,
        notifyMarketing: notifications.marketing,
        onboardingData,
      })
      .where(eq(profiles.id, user.id));

    /**
     * Step 2: Upsert the assistant_profiles row.
     *
     * "Upsert" means insert-or-update: if a row for this assistant already
     * exists (i.e. they re-submitted onboarding), update it instead of failing.
     * `onConflictDoUpdate` handles this — if the INSERT hits the unique constraint
     * on `profileId`, it runs the SET clause instead.
     *
     * `skills` is stored as a comma-separated string ("lash, jewelry") because
     * the assistant_profiles table uses a `text` column for specialties.
     * This is intentional — skills are only ever displayed as a list, never
     * individually queried, so an array column isn't needed.
     */
    const specialties = skills.join(", ");
    await db
      .insert(assistantProfiles)
      .values({
        profileId: user.id,
        title: preferredTitle || null,
        specialties,
        bio: bio || null,
      })
      .onConflictDoUpdate({
        target: assistantProfiles.profileId,
        set: {
          title: preferredTitle || null,
          specialties,
          bio: bio || null,
        },
      });
  } else {
    /**
     * Client path — parse and validate against the client onboarding schema.
     */
    const data = onboardingSchema.parse(raw);

    const {
      firstName,
      email,
      phone,
      source,
      notifications,
      interests,
      allergies,
      availability,
      referral,
      waiverAgreed,
      cancellationAgreed,
      photoConsent,
      birthday,
    } = data;

    /**
     * Fields that go into the JSONB `onboarding_data` column for clients.
     * These capture preferences and consents that are displayed on the client
     * card but aren't filtered or sorted on in SQL, so they live in JSONB.
     *
     * Shape:
     * {
     *   interests: ("lash" | "jewelry" | "crochet" | "consulting")[]
     *   allergies: { adhesive: bool, latex: bool, nickel: bool, fragrances: bool, none: bool, notes: string }
     *   availability: { weekdays: bool, weekends: bool, mornings: bool, afternoons: bool, evenings: bool }
     *   referral: { referrerName: string, referrerEmail: string, referrerPhone: string, skipped: bool }
     *   waiverAgreed: bool
     *   cancellationAgreed: bool
     *   photoConsent: "" | "yes" | "no"
     *   birthday: string (ISO date string or "")
     * }
     */
    const onboardingData = {
      interests,
      allergies,
      availability,
      referral,
      waiverAgreed,
      cancellationAgreed,
      photoConsent,
      birthday,
    };

    await db
      .update(profiles)
      .set({
        firstName,
        email,
        phone: phone || null,
        source, // how they discovered T Creative — stored as an enum
        notifySms: notifications.sms,
        notifyEmail: notifications.email,
        notifyMarketing: notifications.marketing,
        onboardingData,
      })
      .where(eq(profiles.id, user.id));
  }
}
