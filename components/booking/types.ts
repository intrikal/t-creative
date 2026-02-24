/**
 * components/booking/types.ts — Domain types for the public booking storefront.
 *
 * All types in this file represent the props contract between the server component
 * (`app/book/[slug]/page.tsx`) and the client component tree (`BookingPage` and
 * its children).
 *
 * ## Why separate types from the component file?
 * The `BookingPage` component tree is large (multiple sub-components, constants,
 * helpers). Keeping types in a standalone file means:
 * - Sub-components can import only what they need without importing the entire page.
 * - The server component can import `BookingPageProps` without importing client-only
 *   code (Framer Motion, navigator.clipboard, etc.).
 * - Type definitions are easier to find and review in isolation.
 *
 * ## Data origin
 * All types here map to data fetched by the server component from the Postgres DB
 * via Drizzle, then serialised to plain objects before being passed as RSC props.
 * Dates are always serialised to strings (ISO 8601) before crossing the
 * server/client boundary.
 */

/** Studio booking policies as stored in `onboarding_data.policies`. */
export interface StudioPolicies {
  /** Hours before appointment when free cancellation expires. null = no policy set. */
  cancellationWindowHours: number | null;
  /** Fee in cents charged for late cancellations. null = no fee. */
  cancellationFeeInCents: number | null;
  /** Fee in cents charged for no-shows. null = no fee. */
  noShowFeeInCents: number | null;
  /** "instant" | "manual" — currently always "manual" (admin approves all bookings). */
  bookingConfirmation: string;
}

/**
 * IntakeCategory — per-category intake configuration set during admin onboarding.
 * Only populated for categories where the admin configured intake instructions.
 */
export interface IntakeCategory {
  /** Prep instructions shown to the client before their appointment. */
  prep: string;
  /** Map of question keys to enabled/disabled. Keys are camelCase slugs. */
  questions: Record<string, boolean>;
}

/**
 * Studio — all studio-level data passed from the server component.
 * Derived from the admin's `profiles.onboarding_data` JSONB column.
 */
export interface Studio {
  name: string;
  bio: string;
  /**
   * Location type key from onboardingData.location.type.
   * Valid values: "home_studio" | "salon" | "mobile" | "virtual".
   */
  locationType: string;
  /** Free-text area name displayed alongside the location type (e.g. "Brooklyn, NY"). */
  locationArea: string;
  socials: { instagram: string; tiktok: string; facebook: string };
  /** Google OAuth profile photo URL, or null if not available. */
  avatarUrl: string | null;
  /** Admin's given first name, shown in the "Meet …" section. */
  firstName: string;
  policies: StudioPolicies;
  /** Keyed by category slug. Only populated for categories where intake was configured. */
  intake: Record<string, IntakeCategory>;
  /** Whether the loyalty rewards program is enabled for this studio. */
  rewardsEnabled: boolean;
  /**
   * Per-category waitlist flags from onboardingData.policies.waitlist.
   * Phase 1 signal only — not currently used to gate CTAs. Phase 2 will replace
   * this with per-slot availability from the calendar system.
   */
  waitlist: Record<string, boolean | string>;
  /** Default opening/closing times from the admin's working hours config. */
  schedule: { startTime: string | null; endTime: string | null };
}

/** A single bookable service from the `services` table. */
export interface Service {
  id: number;
  /** Category slug: "lash" | "jewelry" | "crochet" | "consulting" */
  category: string;
  name: string;
  /** Price in cents. null = price-on-request (shown as "Contact for quote"). */
  priceInCents: number | null;
  /** Deposit in cents required to hold the appointment. null = no deposit. */
  depositInCents: number | null;
  /** Appointment length in minutes. null = duration varies. */
  durationMinutes: number | null;
  description: string | null;
}

/**
 * ServiceAddOn — optional upsell attached to a parent service.
 * Sourced from the `service_add_ons` table. Shown inline on each service card.
 */
export interface ServiceAddOn {
  id: number;
  /** Foreign key linking back to the parent `services` row. */
  serviceId: number;
  name: string;
  description: string | null;
  /** Additional cost in cents on top of the base service price. */
  priceInCents: number;
  /** Extra minutes added to the appointment duration. 0 = no extension. */
  additionalMinutes: number;
}

/** A single approved + featured client review. */
export interface FeaturedReview {
  id: number;
  /** 1–5 integer star rating. */
  rating: number;
  body: string | null;
  /** Service the client booked when they left this review. */
  serviceName: string | null;
  clientFirstName: string;
}

/** Aggregate review statistics across all approved reviews. */
export interface ReviewStats {
  /** Total count of approved reviews (not just featured). */
  count: number;
  /** Average rating, rounded to one decimal place. */
  avg: number;
}

/** Props contract between the server component (page.tsx) and BookingPage (client). */
export interface BookingPageProps {
  studio: Studio;
  services: Service[];
  featuredReviews: FeaturedReview[];
  reviewStats: ReviewStats;
  /**
   * Add-ons pre-grouped by service ID for O(1) lookup in ServiceCard.
   * Built by the server component using Array.reduce — avoids repeated
   * `.filter()` calls per card during render.
   */
  addOnsByService: Record<number, ServiceAddOn[]>;
  /** URL slug used to build the shareable booking link in CopyLinkButton. */
  slug: string;
}
