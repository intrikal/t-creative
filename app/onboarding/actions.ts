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
import { services as servicesTable } from "@/db/schema/services";
import {
  onboardingSchema,
  assistantOnboardingSchema,
  adminOnboardingSchema,
  type OnboardingData,
  type AssistantOnboardingData,
  type AdminOnboardingData,
} from "@/lib/onboarding-schema";
import { createClient } from "@/utils/supabase/server";

export async function saveOnboardingData(
  raw: OnboardingData | AssistantOnboardingData | AdminOnboardingData,
  role: "client" | "assistant" | "admin" = "client",
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

  if (role === "admin") {
    const {
      firstName,
      lastName,
      email,
      phone,
      notifySms,
      notifyEmail,
      studioName,
      bio,
      locationType,
      locationArea,
      bookingNotice,
      socials,
      services,
      workingHours,
      intake,
      waitlist,
      bookingConfirmation,
      cancellationFee,
      cancellationWindow,
      noShowFee,
      rewards,
    } = adminOnboardingSchema.parse(raw);

    console.log("[onboarding/admin] user.id:", user.id);
    console.log("[onboarding/admin] identity:", { firstName, lastName, email, phone });
    console.log("[onboarding/admin] studio:", { studioName, bio, locationType, locationArea });
    console.log("[onboarding/admin] services:", JSON.stringify(services, null, 2));
    console.log("[onboarding/admin] rewards.enabled:", rewards?.enabled);
    console.log(
      "[onboarding/admin] rewards.tiers:",
      rewards?.tier1Name,
      rewards?.tier2Name,
      rewards?.tier3Name,
      rewards?.tier4Name,
    );

    // Strip empty handles so we don't store blank strings in the DB.
    const filteredSocials = Object.fromEntries(
      Object.entries(socials ?? {}).filter(([, v]) => v.trim() !== ""),
    );

    const SERVICE_CATEGORIES = {
      lash: "lash",
      jewelry: "jewelry",
      crochet: "crochet",
      consulting: "consulting",
    } as const;
    const SERVICE_NAMES = {
      lash: "Lash Extensions",
      jewelry: "Permanent Jewelry",
      crochet: "Crochet",
      consulting: "Consulting",
    } as const;
    type ServiceKey = keyof typeof SERVICE_CATEGORIES;
    const serviceInserts = (
      Object.entries(services ?? {}) as [
        ServiceKey,
        { enabled: boolean; price: string; duration: string; deposit: string },
      ][]
    )
      .filter(([, s]) => s.enabled && s.price)
      .map(([key, s]) => ({
        category: SERVICE_CATEGORIES[key] as "lash" | "jewelry" | "crochet" | "consulting",
        name: SERVICE_NAMES[key],
        priceInCents: Math.round(parseFloat(s.price) * 100),
        depositInCents: s.deposit ? Math.round(parseFloat(s.deposit) * 100) : null,
        durationMinutes: parseInt(s.duration) || null,
        isActive: true,
      }));

    // Pull the Google profile photo directly from auth metadata so it's always
    // in sync with the user's Google account without requiring a form field.
    const googleAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

    const profileData = {
      role: "admin" as const,
      firstName,
      lastName: lastName || "",
      email,
      phone: phone || null,
      notifySms: notifySms ?? true,
      notifyEmail: notifyEmail ?? true,
      avatarUrl: googleAvatarUrl,
      onboardingData: {
        studioName: studioName || null,
        bio: bio || null,
        location: {
          type: locationType || "home_studio",
          area: locationArea || null,
        },
        bookingNoticeHours: bookingNotice ? parseInt(bookingNotice) : 24,
        socials: filteredSocials,
        schedule: workingHours
          ? {
              selectedDates: (() => {
                try {
                  return JSON.parse(workingHours.selectedDates || "[]");
                } catch {
                  return [];
                }
              })(),
              dayOverrides: (() => {
                try {
                  return JSON.parse(workingHours.dayOverrides || "{}");
                } catch {
                  return {};
                }
              })(),
              defaultStartTime: workingHours.defaultStartTime,
              defaultEndTime: workingHours.defaultEndTime,
              appointmentGap: parseInt(workingHours.appointmentGap) || 15,
              lunchBreak: workingHours.lunchBreak,
              lunchStart: workingHours.lunchBreak ? workingHours.lunchStart || "12:00" : null,
              lunchDuration: workingHours.lunchBreak
                ? parseInt(workingHours.lunchDuration) || 30
                : null,
            }
          : null,
        intake: intake
          ? {
              lash: services.lash?.enabled
                ? {
                    prep: intake.lash.prep || null,
                    questions: {
                      adhesiveAllergy: intake.lash.adhesiveAllergy,
                      contactLenses: intake.lash.contactLenses,
                      previousLashes: intake.lash.previousLashes,
                      desiredLook: intake.lash.desiredLook,
                    },
                  }
                : null,
              jewelry: services.jewelry?.enabled
                ? {
                    prep: intake.jewelry.prep || null,
                    questions: {
                      metalAllergy: intake.jewelry.metalAllergy,
                      designPreference: intake.jewelry.designPreference,
                    },
                  }
                : null,
              crochet: services.crochet?.enabled
                ? {
                    prep: intake.crochet.prep || null,
                    questions: {
                      hairType: intake.crochet.hairType,
                      desiredStyle: intake.crochet.desiredStyle,
                      scalpSensitivity: intake.crochet.scalpSensitivity,
                    },
                  }
                : null,
              consulting: services.consulting?.enabled
                ? {
                    prep: intake.consulting.prep || null,
                    questions: {
                      serviceInterest: intake.consulting.serviceInterest,
                      previousExperience: intake.consulting.previousExperience,
                      goal: intake.consulting.goal,
                    },
                  }
                : null,
            }
          : null,
        policies: {
          bookingConfirmation: bookingConfirmation ?? "instant",
          waitlist: waitlist ?? { lash: true, jewelry: true, crochet: true, consulting: "request" },
          cancellationFeeInCents: cancellationFee
            ? Math.round(parseFloat(cancellationFee) * 100)
            : null,
          cancellationWindowHours: cancellationWindow ? parseInt(cancellationWindow) : null,
          noShowFeeInCents: noShowFee ? Math.round(parseFloat(noShowFee) * 100) : null,
        },
        rewards: rewards?.enabled
          ? {
              enabled: true,
              pointsPerDollar: parseInt(rewards.pointsPerDollar) || 10,
              pointsToRedeem: parseInt(rewards.pointsToRedeem) || 100,
              bonuses: {
                firstBooking: rewards.firstBookingBonus
                  ? parseInt(rewards.firstBookingBonus)
                  : null,
                birthday: rewards.birthdayBonus ? parseInt(rewards.birthdayBonus) : null,
                referral: rewards.referralBonus ? parseInt(rewards.referralBonus) : null,
                referee: rewards.refereeBonus ? parseInt(rewards.refereeBonus) : null,
                review: rewards.reviewBonus ? parseInt(rewards.reviewBonus) : null,
                rebook: rewards.rebookBonus ? parseInt(rewards.rebookBonus) : null,
                milestone5th: rewards.milestoneBonus ? parseInt(rewards.milestoneBonus) : null,
                socialShare: rewards.socialShareBonus ? parseInt(rewards.socialShareBonus) : null,
                productPurchase: rewards.productPurchaseBonus
                  ? parseInt(rewards.productPurchaseBonus)
                  : null,
                profileComplete: rewards.profileCompleteBonus
                  ? parseInt(rewards.profileCompleteBonus)
                  : null,
                anniversary: rewards.anniversaryBonus ? parseInt(rewards.anniversaryBonus) : null,
                milestone10th: rewards.milestone10thBonus
                  ? parseInt(rewards.milestone10thBonus)
                  : null,
                newService: rewards.newServiceBonus ? parseInt(rewards.newServiceBonus) : null,
                classAttendance: rewards.classAttendanceBonus
                  ? parseInt(rewards.classAttendanceBonus)
                  : null,
                packagePurchase: rewards.packagePurchaseBonus
                  ? parseInt(rewards.packagePurchaseBonus)
                  : null,
                programComplete: rewards.programCompleteBonus
                  ? parseInt(rewards.programCompleteBonus)
                  : null,
                certification: rewards.certificationBonus
                  ? parseInt(rewards.certificationBonus)
                  : null,
              },
              tiers: [
                {
                  name: rewards.tier1Name || "Member",
                  threshold: 0,
                  multiplier: parseFloat(rewards.tier1Multiplier) || 1,
                },
                {
                  name: rewards.tier2Name || "Regular",
                  threshold: parseInt(rewards.tier2Threshold) || 500,
                  multiplier: parseFloat(rewards.tier2Multiplier) || 1.25,
                },
                {
                  name: rewards.tier3Name || "VIP",
                  threshold: parseInt(rewards.tier3Threshold) || 2000,
                  multiplier: parseFloat(rewards.tier3Multiplier) || 1.5,
                },
                {
                  name: rewards.tier4Name || "Elite",
                  threshold: parseInt(rewards.tier4Threshold) || 5000,
                  multiplier: parseFloat(rewards.tier4Multiplier) || 2,
                },
              ],
              pointsExpiryMonths: rewards.pointsExpiry ? parseInt(rewards.pointsExpiry) : null,
            }
          : { enabled: false },
      },
    };

    await db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({ id: user.id, ...profileData })
        .onConflictDoUpdate({ target: profiles.id, set: profileData });

      // Clear existing services before reinserting so re-running onboarding
      // (e.g. updating prices) always produces a clean, up-to-date catalog.
      await tx.delete(servicesTable);
      if (serviceInserts.length > 0) {
        await tx.insert(servicesTable).values(serviceInserts);
      }
      console.log("[onboarding/admin] ✓ profile upserted, services saved");
    });

    return;
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
