/**
 * lib/onboarding-schema.ts — Zod validation schemas for all three onboarding flows.
 *
 * ## What
 * Defines the exact shape and validation rules for every field collected during
 * onboarding, for all three user roles:
 * - `onboardingSchema`        → client flow
 * - `assistantOnboardingSchema` → assistant (staff) flow
 * - `adminOnboardingSchema`   → admin / studio-owner setup flow
 *
 * ## Why it exists (single source of truth)
 * Centralising validation here means the browser-side form (TanStack Form in
 * OnboardingFlow.tsx) and the server-side action (`app/onboarding/actions.ts`)
 * share identical rules. Changing a field's constraints in one place propagates
 * everywhere automatically — no risk of the client and server diverging.
 *
 * ## How it's used
 * 1. **Type inference** — `z.infer<typeof onboardingSchema>` produces the
 *    `OnboardingData` TypeScript type used as the action's parameter type.
 * 2. **Server-side validation** — `actions.ts` calls `.parse(raw)` on the
 *    appropriate schema before touching the database. A Zod parse error
 *    surfaces as a thrown ZodError, which Next.js propagates to the client.
 * 3. **Default values** — `OnboardingFlow.tsx` reads field names from the
 *    schemas (implicitly) when initialising TanStack Form default values.
 *
 * ## Schema design notes
 * - `z.string().optional().or(z.literal(""))` is used for optional text inputs
 *   because HTML inputs produce `""` when cleared, not `undefined`. Without
 *   the `.or(z.literal(""))` branch, Zod would reject empty strings.
 * - `availableDates` and `availableDateOverrides` are stored as JSON strings
 *   (not arrays/objects) because TanStack Form fields must be primitives.
 *   The action deserialises them with JSON.parse before writing to the DB.
 * - The `rewards` object in `adminOnboardingSchema` uses flat string fields
 *   (e.g. `tier1Name`, `tier2Threshold`) to avoid nested array complexity in
 *   TanStack Form; the action reconstructs the nested `tiers` array.
 *
 * ## Related files
 * - components/onboarding/OnboardingFlow.tsx — form default values mirror these schemas
 * - app/onboarding/actions.ts               — calls `.parse()` on each schema
 * - db/schema/users.ts                      — `profiles.onboardingData` stores the result
 */
import { z } from "zod/v4";

// `z.object()` defines a schema (blueprint/contract) for an object with specific fields.
// Each field inside specifies what type it must be and its validation rules.
export const onboardingSchema = z.object({
  // `z.string().min(1, "...")` validates that the value is a string with at least 1 character.
  // The second argument is a custom error message shown when validation fails.
  /** Client's first name. */
  firstName: z.string().min(1, "Please enter your name"),

  /** Client's last name. */
  lastName: z.string().optional().or(z.literal("")),

  // `z.array(z.enum([...]))` means an array that can only contain the listed string values.
  // `z.enum([...])` restricts each element to one of these exact strings — like a dropdown's allowed options.
  /** Which service zones the client is interested in. */
  interests: z.array(z.enum(["lash", "jewelry", "crochet", "consulting"])),

  /** Allergies & sensitivities (shown if lash or jewelry selected). */
  allergies: z.object({
    // `z.boolean()` validates that the value is true or false.
    adhesive: z.boolean(),
    latex: z.boolean(),
    nickel: z.boolean(),
    fragrances: z.boolean(),
    none: z.boolean(),
    // `.optional().or(z.literal(""))` makes a field optional OR allows an empty string.
    // Needed because HTML inputs produce "" (empty string) when cleared, not `undefined`.
    notes: z.string().optional().or(z.literal("")),
  }),

  /** Contact info. */
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().or(z.literal("")),

  /** Preferred availability. */
  availability: z.object({
    weekdays: z.boolean(),
    weekends: z.boolean(),
    mornings: z.boolean(),
    afternoons: z.boolean(),
    evenings: z.boolean(),
  }),

  /** How the client discovered T Creative. */
  source: z.enum([
    "instagram",
    "tiktok",
    "pinterest",
    "word_of_mouth",
    "google_search",
    "referral",
    "website_direct",
  ]),

  /** Notification preferences. */
  notifications: z.object({
    sms: z.boolean(),
    email: z.boolean(),
    marketing: z.boolean(),
  }),

  /** Referral info. */
  referral: z.object({
    referrerName: z.string().optional().or(z.literal("")),
    referrerEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
    referrerPhone: z.string().optional().or(z.literal("")),
    skipped: z.boolean(),
  }),

  /** Service waiver agreement. */
  waiverAgreed: z.boolean(),

  /** Cancellation policy agreement. */
  cancellationAgreed: z.boolean(),

  /** Photo / portfolio consent. */
  photoConsent: z.enum(["yes", "no", ""]),

  /** Optional birthday for promos (month/day only — no year for privacy). */
  birthday: z
    .string()
    // Regex breakdown: month 01-12, slash, day 01-31.
    // .optional().or(z.literal("")) allows the field to be blank or omitted.
    .regex(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/, "Use MM/DD format")
    .optional()
    .or(z.literal("")),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

export const STEPS = [
  { id: "name", title: "What should we call you?" },
  { id: "interests", title: "What brings you to T Creative?" },
  { id: "allergies", title: "Any sensitivities we should know about?" },
  { id: "contact", title: "How can we reach you?" },
  { id: "policies", title: "Our policies" },
  { id: "final_prefs", title: "Almost done!" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Assistant onboarding schema                                        */
/* ------------------------------------------------------------------ */

export const assistantOnboardingSchema = z.object({
  firstName: z.string().min(1, "Please enter your name"),
  preferredTitle: z.string().optional().or(z.literal("")),
  skills: z
    .array(z.enum(["lash", "jewelry", "crochet", "consulting"]))
    .min(1, "Pick at least one skill"),
  experienceLevel: z.enum(["junior", "mid", "senior"]),
  bio: z.string().optional().or(z.literal("")),

  /** Default availability hours (apply to all selected dates unless overridden). */
  availableDefaultStart: z.string().default("09:00"),
  availableDefaultEnd: z.string().default("17:00"),
  /** JSON-encoded string[] of "YYYY-MM-DD" dates the assistant is available. */
  availableDates: z.string().default("[]"),
  /** JSON-encoded Record<string, {startTime, endTime}> for per-date overrides. */
  availableDateOverrides: z.string().default("{}"),
  /** Whether a lunch break is blocked off during the shift. */
  availableLunchBreak: z.boolean().default(false),
  availableLunchStart: z.string().default("12:00"),
  availableLunchDuration: z.string().default("30"),

  emergencyContactName: z.string().min(1, "Required"),
  emergencyContactPhone: z.string().min(1, "Required"),
  emergencyContactRelation: z.string().optional().or(z.literal("")),

  /** Certifications held by the assistant. */
  certifications: z
    .array(z.enum(["tcreative_lash", "tcreative_jewelry", "external_lash", "external_jewelry"]))
    .optional(),

  /** Preferred work style — client-facing, support, or both. */
  workStyle: z.enum(["client_facing", "back_of_house", "both"]),

  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().or(z.literal("")),
  instagramHandle: z.string().optional().or(z.literal("")),
  notifications: z.object({
    sms: z.boolean(),
    email: z.boolean(),
    marketing: z.boolean(),
  }),

  /** Whether the assistant also offers training or classes to other artists. */
  offersTraining: z.boolean(),
  /** Which training formats they're comfortable with (only relevant if offersTraining). */
  trainingFormats: z.array(z.enum(["one_on_one", "group", "online", "in_person"])).optional(),

  /** Portfolio & socials (separate from personal). */
  portfolioInstagram: z.string().optional().or(z.literal("")),
  tiktokHandle: z.string().optional().or(z.literal("")),
  portfolioWebsite: z.string().optional().or(z.literal("")),

  /** Studio policy acknowledgments — all must be true before saving. */
  policyClientPhotos: z.boolean(),
  policyConfidentiality: z.boolean(),
  policyConduct: z.boolean(),
  policyCompensation: z.boolean(),
});

export type AssistantOnboardingData = z.infer<typeof assistantOnboardingSchema>;

export const ASSISTANT_STEPS = [
  { id: "name", title: "What should we call you?" },
  { id: "role_skills", title: "Your role & skills" },
  { id: "shift_availability", title: "Your availability" },
  { id: "emergency_contact", title: "Emergency contact" },
  { id: "portfolio", title: "Portfolio & socials" },
  { id: "contact_prefs", title: "Contact preferences" },
  { id: "policies", title: "Studio policies" },
] as const;

export type AssistantStepId = (typeof ASSISTANT_STEPS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Admin onboarding schema                                            */
/* ------------------------------------------------------------------ */

const serviceSlotSchema = z.object({
  enabled: z.boolean(),
  price: z.string(),
  duration: z.string(),
  deposit: z.string(),
});

export const adminOnboardingSchema = z.object({
  firstName: z.string().min(1, "Please enter your name"),
  lastName: z.string(),
  email: z.string().email("Enter a valid email"),
  phone: z.string(),
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
  studioName: z.string(),
  bio: z.string(),
  locationType: z.enum(["home_studio", "salon_suite", "mobile"]),
  locationArea: z.string(),
  bookingNotice: z.string(),

  socials: z.object({
    instagram: z.string(),
    instagram2: z.string(),
    instagram3: z.string(),
    instagram4: z.string(),
    tiktok: z.string(),
    facebook: z.string(),
    youtube: z.string(),
    pinterest: z.string(),
    linkedin: z.string(),
    google: z.string(),
    website: z.string(),
  }),

  services: z.object({
    lash: serviceSlotSchema,
    jewelry: serviceSlotSchema,
    crochet: serviceSlotSchema,
    consulting: serviceSlotSchema,
  }),

  waitlist: z.object({
    lash: z.boolean(),
    jewelry: z.boolean(),
    crochet: z.boolean(),
    consulting: z.enum(["off", "request", "waitlist"]),
  }),

  intake: z.object({
    lash: z.object({
      prep: z.string(),
      adhesiveAllergy: z.boolean(),
      contactLenses: z.boolean(),
      previousLashes: z.boolean(),
      desiredLook: z.boolean(),
    }),
    jewelry: z.object({
      prep: z.string(),
      metalAllergy: z.boolean(),
      designPreference: z.boolean(),
    }),
    crochet: z.object({
      prep: z.string(),
      hairType: z.boolean(),
      desiredStyle: z.boolean(),
      scalpSensitivity: z.boolean(),
    }),
    consulting: z.object({
      prep: z.string(),
      serviceInterest: z.boolean(),
      previousExperience: z.boolean(),
      goal: z.boolean(),
    }),
  }),

  workingHours: z.object({
    defaultStartTime: z.string(),
    defaultEndTime: z.string(),
    appointmentGap: z.string(),
    lunchBreak: z.boolean(),
    lunchStart: z.string(),
    lunchDuration: z.string(),
    selectedDates: z.string(), // JSON-encoded string[]
    dayOverrides: z.string(), // JSON-encoded Record<string, {startTime, endTime}>
  }),

  bookingConfirmation: z.enum(["instant", "manual"]),
  cancellationFee: z.string(),
  cancellationWindow: z.string(),
  noShowFee: z.string(),

  rewards: z.object({
    enabled: z.boolean(),
    pointsPerDollar: z.string(),
    pointsToRedeem: z.string(),
    firstBookingBonus: z.string(),
    birthdayBonus: z.string(),
    referralBonus: z.string(),
    refereeBonus: z.string(),
    reviewBonus: z.string(),
    rebookBonus: z.string(),
    milestoneBonus: z.string(),
    milestone10thBonus: z.string(),
    socialShareBonus: z.string(),
    productPurchaseBonus: z.string(),
    profileCompleteBonus: z.string(),
    anniversaryBonus: z.string(),
    newServiceBonus: z.string(),
    classAttendanceBonus: z.string(),
    packagePurchaseBonus: z.string(),
    programCompleteBonus: z.string(),
    certificationBonus: z.string(),
    tier1Name: z.string(),
    tier1Threshold: z.string(),
    tier1Multiplier: z.string(),
    tier2Name: z.string(),
    tier2Threshold: z.string(),
    tier2Multiplier: z.string(),
    tier3Name: z.string(),
    tier3Threshold: z.string(),
    tier3Multiplier: z.string(),
    tier4Name: z.string(),
    tier4Threshold: z.string(),
    tier4Multiplier: z.string(),
    pointsExpiry: z.string(),
  }),
});

export type AdminOnboardingData = z.infer<typeof adminOnboardingSchema>;
