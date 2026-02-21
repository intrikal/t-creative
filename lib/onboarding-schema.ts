/**
 * onboarding-schema.ts — Zod validation schema for onboarding data
 *
 * What: Defines the exact shape and validation rules for every piece of data
 *       collected during the onboarding flow.
 * Why: Centralizes all validation in one place so the form, the API, and any
 *      database writes can share the same rules. If a field's requirements
 *      change, you update it here and it propagates everywhere.
 * How: Uses Zod (a schema validation library) to declare each field's type,
 *      constraints, and error messages. The schema is then used by TanStack Form
 *      in OnboardingFlow.tsx to validate user input before submission.
 *
 * Key concepts:
 * - z.object(): Defines an object with specific fields — like a blueprint.
 * - z.enum(): Restricts a value to a set of allowed strings (like a dropdown).
 * - z.infer: Automatically generates a TypeScript type from the schema, so
 *   the type and the validation rules never get out of sync.
 * - STEPS array: Defines the order and titles of onboarding steps. Used by
 *   OnboardingFlow to know which steps exist and what to display.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — consumes this schema for form state
 * - app/onboarding/page.tsx — the page that renders the flow
 */
import { z } from "zod/v4";

// `z.object()` defines a schema (blueprint/contract) for an object with specific fields.
// Each field inside specifies what type it must be and its validation rules.
export const onboardingSchema = z.object({
  // `z.string().min(1, "...")` validates that the value is a string with at least 1 character.
  // The second argument is a custom error message shown when validation fails.
  /** Client's first name. */
  firstName: z.string().min(1, "Please enter your name"),

  // `z.array(z.enum([...]))` means an array that can only contain the listed string values.
  // `z.enum([...])` restricts each element to one of these exact strings — like a dropdown's allowed options.
  /** Which service zones the client is interested in. */
  interests: z
    .array(z.enum(["lash", "jewelry", "crochet", "consulting"]))
    .min(1, "Pick at least one service"),

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
  source: z.enum(["instagram", "word_of_mouth", "google_search", "referral", "website_direct"]),

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

  shiftAvailability: z.object({
    monday: z.boolean(),
    tuesday: z.boolean(),
    wednesday: z.boolean(),
    thursday: z.boolean(),
    friday: z.boolean(),
    saturday: z.boolean(),
    sunday: z.boolean(),
  }),
  preferredShiftTime: z.enum(["morning", "afternoon", "evening", "flexible"]),
  maxHoursPerWeek: z.number().min(1).max(60).optional(),

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
});

export type AssistantOnboardingData = z.infer<typeof assistantOnboardingSchema>;

export const ASSISTANT_STEPS = [
  { id: "name", title: "What should we call you?" },
  { id: "role_skills", title: "Your role & skills" },
  { id: "shift_availability", title: "Your availability" },
  { id: "emergency_contact", title: "Emergency contact" },
  { id: "contact_prefs", title: "Contact preferences" },
] as const;

export type AssistantStepId = (typeof ASSISTANT_STEPS)[number]["id"];
