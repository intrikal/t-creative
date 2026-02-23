/**
 * components/booking/BookingPage.tsx — Public-facing studio storefront UI
 *
 * ## Responsibility
 * Renders the complete client-visible booking page for T Creative Studio at
 * `/book/[slug]`. All data is received as props from the Server Component
 * (`app/book/[slug]/page.tsx`) — this file contains no data fetching.
 *
 * ## Architecture: Server Component → Client Component split
 * The page uses the "data-down" pattern:
 *
 *   Server Component (page.tsx)
 *     ├── runs on server, fetches DB data, builds props
 *     └── renders → <BookingPage> (this file, "use client")
 *                      ├── handles scroll, clipboard, animations (needs browser APIs)
 *                      └── renders sub-components: ServiceCard, CopyLinkButton, etc.
 *
 * This split is intentional — Framer Motion, navigator.clipboard, and scroll
 * imperatives require a browser context, so the entire presentational layer
 * must be a Client Component. The data layer stays server-only so DB credentials
 * never reach the browser.
 *
 * ## Layout
 * Two-column on desktop (lg+), single-column stacked on mobile:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  Mobile sticky header (lg:hidden)           │
 *   ├──────────────┬──────────────────────────────┤
 *   │  Sidebar     │  Main content                │
 *   │  (lg only,   │  ─ New client callout        │
 *   │   sticky)    │  ─ Services (tabs)           │
 *   │              │  ─ Gallery                   │
 *   │  Logo        │  ─ Reviews                   │
 *   │  Avatar      │  ─ About                     │
 *   │  Bio         │  ─ How it works              │
 *   │  Hours       │  ─ Rewards (conditional)     │
 *   │  Socials     │  ─ Referral                  │
 *   │  CTA         │  ─ Policies (conditional)    │
 *   │              │  ─ FAQ (conditional)         │
 *   │              │  ─ Contact CTA               │
 *   └──────────────┴──────────────────────────────┘
 *   │  Footer                                      │
 *   └──────────────────────────────────────────────┘
 *
 * ## Conditional sections
 * - Reviews: only rendered if `featuredReviews.length > 0`
 * - Rewards: only rendered if `studio.rewardsEnabled === true`
 * - Policies: only rendered if at least one fee/window is configured
 * - FAQ: only rendered if at least one category has `intake[cat].prep` text
 * - Business hours: only shown when `schedule.startTime` or `endTime` is set
 *
 * ## Phase 2 integration points
 * - ServiceCard CTAs ("Book this service" / "Waitlist") currently show a
 *   placeholder alert. Phase 2 wires these to a calendar modal or Square API.
 * - The "Most popular" badge is derived from `services.sort_order` (first service
 *   per category, when multiple exist). Phase 2 can replace this with a booking
 *   count query from the `bookings` table.
 * - CopyLinkButton constructs the URL client-side from the slug prop. Phase 2
 *   may replace with a personalised referral code per client.
 * - Gallery section is a placeholder grid. Phase 2 adds Supabase Storage images
 *   fetched from the `media` table.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LuEye,
  LuGem,
  LuScissors,
  LuLightbulb,
  LuInstagram,
  LuMapPin,
  LuClock,
  LuStar,
  LuCamera,
  LuShieldCheck,
  LuMessageCircle,
  LuCalendarCheck,
  LuGift,
  LuSparkles,
  LuCalendar,
  LuCopy,
  LuCheck,
  LuUsers,
  LuInfo,
  LuFlame,
} from "react-icons/lu";
import { SiTiktok, SiFacebook } from "react-icons/si";
import { fadeUp, stagger } from "@/components/onboarding/panels/shared";
import { TCLogo } from "@/components/TCLogo";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

/** Studio booking policies as stored in onboardingData.policies. */
interface StudioPolicies {
  /** Hours before appointment when free cancellation expires. null = no policy set. */
  cancellationWindowHours: number | null;
  /** Fee in cents charged for late cancellations. null = no fee. */
  cancellationFeeInCents: number | null;
  /** Fee in cents charged for no-shows. null = no fee. */
  noShowFeeInCents: number | null;
  /** "instant" | "manual" — currently always "manual" (Trini approves all bookings). */
  bookingConfirmation: string;
}

/** Per-category intake configuration set during admin onboarding. */
interface IntakeCategory {
  /** Prep instructions shown to the client before their appointment. */
  prep: string;
  /** Map of question keys to enabled/disabled. Keys are camelCase slugs (e.g. "adhesiveAllergy"). */
  questions: Record<string, boolean>;
}

/**
 * Studio — all studio-level data passed from the server component.
 * Derived from the admin's `profiles.onboarding_data` JSONB column.
 */
interface Studio {
  name: string;
  bio: string;
  /** Key from LOCATION_LABELS (e.g. "home_studio", "salon", "mobile", "virtual"). */
  locationType: string;
  /** Free-text area name (e.g. "Brooklyn, NY"). */
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
   * Phase 1: category-level signal (e.g. `{ lash: true, jewelry: "request" }`).
   * Phase 2: will be replaced with per-slot availability from the calendar system.
   * Not currently used to gate the primary CTA — both Book and Waitlist buttons
   * are always shown, since waitlist is a slot-level concept, not a category state.
   */
  waitlist: Record<string, boolean | string>;
  /** Default opening/closing times from the admin's working hours config. */
  schedule: { startTime: string | null; endTime: string | null };
}

/** A single bookable service from the `services` table. */
interface Service {
  id: number;
  /** Category slug: "lash" | "jewelry" | "crochet" | "consulting" */
  category: string;
  name: string;
  /** Price in cents. null means price-on-request (shown as "Contact for quote"). */
  priceInCents: number | null;
  /** Deposit in cents required to hold the appointment. null = no deposit. */
  depositInCents: number | null;
  /** Appointment length in minutes. null = duration varies. */
  durationMinutes: number | null;
  description: string | null;
}

/**
 * ServiceAddOn — optional upsell attached to a parent service.
 * Sourced from the `service_add_ons` table. Shown inline on the service card.
 */
interface ServiceAddOn {
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

/** A single client review (approved + featured). */
interface FeaturedReview {
  id: number;
  /** 1–5 integer star rating. */
  rating: number;
  body: string | null;
  /** Service the client booked when they left this review. */
  serviceName: string | null;
  clientFirstName: string;
}

/** Aggregate review statistics across all approved reviews. */
interface ReviewStats {
  /** Total count of approved reviews (not just featured). */
  count: number;
  /** Average rating, rounded to one decimal place. */
  avg: number;
}

/** Props contract between the server component (page.tsx) and this client component. */
interface BookingPageProps {
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

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

/** Ordered list of service categories. Order determines tab and card rendering sequence. */
const CATEGORIES = ["lash", "jewelry", "crochet", "consulting"] as const;

/**
 * CATEGORY_META — static display configuration per service category.
 *
 * Centralises all category-specific UI decisions in one place so that adding
 * a new category only requires adding an entry here and in the DB enum — no
 * changes needed in the rendering logic.
 *
 * `satisfies` (not `as`) is used so TypeScript infers the literal types of
 * `icon`, `color`, etc. while still enforcing the shape against the union key.
 */
const CATEGORY_META = {
  lash: {
    label: "Lash Extensions",
    shortLabel: "Lashes",
    description:
      "Classic, hybrid, and volume sets tailored to your eye shape and lifestyle. Every set is fully customized.",
    note: null,
    faqQuestion: "How do I prepare for a lash appointment?",
    icon: LuEye,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-l-rose-400",
    tabActive: "data-[state=active]:text-rose-600",
  },
  jewelry: {
    label: "Permanent Jewelry",
    shortLabel: "Jewelry",
    description:
      "Delicate chains and charms welded directly onto your wrist, ankle, or neck — no clasp, waterproof, yours forever.",
    note: "Welded on — no clasp, no removal. Yours forever.",
    faqQuestion: "How should I prepare for permanent jewelry?",
    icon: LuGem,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-l-amber-400",
    tabActive: "data-[state=active]:text-amber-600",
  },
  crochet: {
    label: "Crochet",
    shortLabel: "Crochet",
    description:
      "Custom protective styles using crochet braids and twists. Low manipulation, high impact.",
    note: null,
    faqQuestion: "How do I prepare for a crochet appointment?",
    icon: LuScissors,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-l-violet-400",
    tabActive: "data-[state=active]:text-violet-600",
  },
  consulting: {
    label: "Consulting",
    shortLabel: "Consult",
    description:
      "One-on-one sessions covering beauty business strategy, technique guidance, and brand development.",
    note: null,
    faqQuestion: "What should I bring to my consulting session?",
    icon: LuLightbulb,
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-l-teal-400",
    tabActive: "data-[state=active]:text-teal-600",
  },
} satisfies Record<
  (typeof CATEGORIES)[number],
  {
    label: string;
    shortLabel: string;
    description: string;
    note: string | null;
    faqQuestion: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
    tabActive: string;
  }
>;

/** Human-readable labels for `locationType` values stored in onboardingData.location.type. */
const LOCATION_LABELS: Record<string, string> = {
  home_studio: "Home Studio",
  salon: "Salon",
  mobile: "Mobile / On-site",
  virtual: "Virtual",
};

/** Static copy for the "How it works" process section. */
const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Browse & choose",
    description: "Pick the service that fits you from the menu below.",
  },
  {
    step: "02",
    title: "Book your spot",
    description: "Select a time and fill out our quick intake form.",
  },
  {
    step: "03",
    title: "Show up & glow",
    description: "We handle everything — just arrive and enjoy the experience.",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Formats a price in cents as a dollar string.
 * Returns "Contact for quote" when `cents` is null, which signals that the
 * service requires individual pricing (e.g. consulting packages).
 *
 * @example formatPrice(7500) → "$75"
 * @example formatPrice(null) → "Contact for quote"
 */
function formatPrice(cents: number | null): string {
  if (cents === null) return "Contact for quote";
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Extracts up to two uppercase initials from a studio or person name.
 * Used as the fallback inside Avatar when no photo is available.
 *
 * @example getInitials("T Creative Studio") → "TC"
 * @example getInitials("Trini") → "T"
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Maps a `locationType` DB key to its display label.
 * Falls back to the raw key if it isn't in LOCATION_LABELS
 * (forward-compatibility for future location types).
 */
function formatLocationType(type: string): string {
  return LOCATION_LABELS[type] ?? type;
}

/**
 * Converts a 24-hour "HH:MM" time string to a compact 12-hour display string.
 * Minutes are omitted when zero to keep the display tight (e.g. "10am" not "10:00am").
 *
 * @example formatTime("09:00") → "9am"
 * @example formatTime("13:30") → "1:30pm"
 * @example formatTime("00:00") → "12am"
 */
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * BookingPage — root client component for the public booking storefront.
 *
 * Derives all display state from props — no internal data fetching.
 * Local UI state (e.g. clipboard copy animation) lives in sub-components.
 */
export function BookingPage({
  studio,
  services,
  featuredReviews,
  reviewStats,
  addOnsByService,
  slug,
}: BookingPageProps) {
  /** Smoothly scrolls to the services section when the header/sidebar CTA is clicked. */
  const scrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
  };

  // Strip the leading "@" once so all downstream href and display uses are consistent.
  const instagramHandle = studio.socials.instagram?.replace("@", "") || null;

  // Only render tabs for categories that actually have active services.
  // This prevents empty tabs if, say, consulting has no services yet.
  const activeCategories = CATEGORIES.filter((cat) => services.some((s) => s.category === cat));
  const defaultTab = activeCategories[0] ?? "lash";

  // Build FAQ items from intake prep text. Categories without prep text are skipped.
  // This means the FAQ section only appears when Trini has configured intake instructions.
  const faqItems = CATEGORIES.filter((cat) => studio.intake[cat]?.prep).map((cat) => ({
    question: CATEGORY_META[cat].faqQuestion,
    answer: studio.intake[cat].prep,
  }));

  // Gate the Policies section — only show it when at least one policy field is populated.
  // The "approval-based booking" row is always shown inside, separately from this gate.
  const hasPolicies =
    studio.policies.cancellationWindowHours !== null ||
    studio.policies.cancellationFeeInCents !== null ||
    studio.policies.noShowFeeInCents !== null;

  // Combine location type + area into a single display string (e.g. "Home Studio · Brooklyn, NY").
  const locationLabel = [formatLocationType(studio.locationType), studio.locationArea]
    .filter(Boolean)
    .join(" · ");

  // Build the social links array, filtering out platforms with no handle configured.
  // `href` is a function so the handle normalisation (strip "@") happens at render,
  // not at definition time — avoids stale closure issues if handles change shape.
  const socialLinks = [
    {
      key: "instagram",
      handle: studio.socials.instagram,
      icon: LuInstagram,
      color: "#E1306C",
      href: (h: string) => `https://instagram.com/${h.replace("@", "")}`,
    },
    {
      key: "tiktok",
      handle: studio.socials.tiktok,
      icon: SiTiktok,
      color: "#000000",
      href: (h: string) => `https://tiktok.com/@${h.replace("@", "")}`,
    },
    {
      key: "facebook",
      handle: studio.socials.facebook,
      icon: SiFacebook,
      color: "#1877F2",
      href: (h: string) => `https://facebook.com/${h.replace("@", "")}`,
    },
  ].filter((s) => s.handle && s.handle.trim() !== "");

  // Used in the "Now booking [Month]" pill — computed at render time.
  const nowBookingMonth = new Date().toLocaleString("en-US", { month: "long" });

  // Derive the business hours display string once, used in both sidebar and mobile hero.
  const hasHours = studio.schedule.startTime || studio.schedule.endTime;
  const hoursLabel =
    studio.schedule.startTime && studio.schedule.endTime
      ? `${formatTime(studio.schedule.startTime)} – ${formatTime(studio.schedule.endTime)}`
      : studio.schedule.startTime
        ? `Opens at ${formatTime(studio.schedule.startTime)}`
        : studio.schedule.endTime
          ? `Closes at ${formatTime(studio.schedule.endTime)}`
          : null;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-stone-900">
      {/* ── Mobile-only sticky header ── */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-stone-700">
            <TCLogo size={20} />
            <span className="text-sm font-medium tracking-wide">{studio.name}</span>
          </div>
          <button
            onClick={scrollToServices}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-95"
          >
            Book a session
          </button>
        </div>
      </header>

      {/* ── Layout wrapper ── */}
      <div className="mx-auto max-w-5xl px-5 lg:flex lg:items-start lg:gap-10 lg:py-12">
        {/* ── Desktop sticky sidebar ── */}
        <aside className="hidden lg:block lg:w-60 lg:shrink-0 xl:w-64">
          <div className="sticky top-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
            {/* Gradient accent strip — mirrors the category color palette */}
            <div className="h-2 bg-gradient-to-r from-rose-400 via-amber-300 to-violet-400" />

            <div className="p-6">
              <div className="mb-5 flex justify-center">
                <TCLogo size={32} className="text-stone-700" />
              </div>

              {/* Avatar — ShadCN Avatar with Google photo and initials fallback */}
              <div className="mb-4 flex justify-center">
                <Avatar className="h-20 w-20 ring-4 ring-rose-50 shadow-sm">
                  <AvatarImage src={studio.avatarUrl ?? undefined} alt={studio.name} />
                  <AvatarFallback className="bg-rose-100 text-xl font-semibold text-rose-400">
                    {getInitials(studio.name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="mb-3 text-center">
                <h1 className="font-display text-xl font-light text-stone-900">{studio.name}</h1>
                {studio.bio && (
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">{studio.bio}</p>
                )}
                {locationLabel && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-400">
                    <LuMapPin className="h-3 w-3 text-rose-400" />
                    {locationLabel}
                  </p>
                )}
              </div>

              {/* "Now booking [Month]" availability signal */}
              <div className="mb-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-500 ring-1 ring-rose-100">
                  <LuCalendar className="h-3 w-3" />
                  Now booking {nowBookingMonth}
                </span>
              </div>

              {/* Review stats — only shown when there is at least one approved review */}
              {reviewStats.count > 0 && (
                <>
                  <Separator className="mb-4" />
                  <div className="mb-4 flex justify-around text-center">
                    <div>
                      <p className="text-base font-semibold text-stone-900">{reviewStats.count}+</p>
                      <p className="text-[10px] text-stone-400">clients</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-stone-900">{reviewStats.avg}★</p>
                      <p className="text-[10px] text-stone-400">rating</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-stone-900">4</p>
                      <p className="text-[10px] text-stone-400">services</p>
                    </div>
                  </div>
                </>
              )}

              {/* Business hours — only shown when schedule is configured */}
              {hasHours && hoursLabel && (
                <>
                  <Separator className="mb-4" />
                  <div className="mb-4 flex items-center gap-2 text-xs text-stone-500">
                    <LuClock className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <span>{hoursLabel}</span>
                  </div>
                </>
              )}

              {/* Social links — only platforms with a non-empty handle are rendered */}
              {socialLinks.length > 0 && (
                <>
                  <Separator className="mb-4" />
                  <div className="mb-4 flex flex-col gap-2">
                    {socialLinks.map(({ key, handle, icon: Icon, color, href }) => (
                      <a
                        key={key}
                        href={href(handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                      >
                        <Icon style={{ color }} className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {handle.startsWith("@") ? handle : `@${handle}`}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}

              <Separator className="mb-4" />

              <button
                onClick={scrollToServices}
                className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-[0.98]"
              >
                Book a session
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0 flex-1 pb-24">
          {/* ── Mobile hero (hidden on desktop — sidebar fills this role) ── */}
          <motion.section
            variants={stagger}
            initial="hidden"
            animate="show"
            className="bg-gradient-to-b from-rose-50/80 via-amber-50/30 to-transparent pb-8 pt-10 text-center lg:hidden"
          >
            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-stone-100">
                <TCLogo size={30} className="text-stone-800" />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="mb-4 flex justify-center">
              <Avatar className="h-24 w-24 shadow-lg ring-4 ring-white">
                <AvatarImage src={studio.avatarUrl ?? undefined} alt={studio.name} />
                <AvatarFallback className="bg-rose-100 text-2xl font-semibold text-rose-400">
                  {getInitials(studio.name)}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display mb-1 text-3xl font-light tracking-wide text-stone-900"
            >
              {studio.name}
            </motion.h1>

            <motion.div variants={fadeUp} className="mb-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-500 ring-1 ring-rose-100">
                <LuCalendar className="h-3 w-3" />
                Now booking {nowBookingMonth}
              </span>
            </motion.div>

            {studio.bio && (
              <motion.p
                variants={fadeUp}
                className="mx-auto mb-4 max-w-xs text-sm leading-relaxed text-stone-500"
              >
                {studio.bio}
              </motion.p>
            )}

            {locationLabel && (
              <motion.div variants={fadeUp} className="mb-3 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow-sm ring-1 ring-stone-100">
                  <LuMapPin className="h-3 w-3 text-rose-400" />
                  {locationLabel}
                </span>
              </motion.div>
            )}

            {/* Mobile business hours pill — mirrors sidebar display */}
            {hoursLabel && (
              <motion.div variants={fadeUp} className="mb-5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow-sm ring-1 ring-stone-100">
                  <LuClock className="h-3 w-3 text-stone-400" />
                  {hoursLabel}
                </span>
              </motion.div>
            )}

            {reviewStats.count > 0 && (
              <motion.div variants={fadeUp} className="mb-6 flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-lg font-semibold text-stone-900">{reviewStats.count}+</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">clients</p>
                </div>
                <div className="h-6 w-px bg-stone-200" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-stone-900">{reviewStats.avg}★</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">rating</p>
                </div>
                <div className="h-6 w-px bg-stone-200" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-stone-900">4</p>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">services</p>
                </div>
              </motion.div>
            )}

            {socialLinks.length > 0 && (
              <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-2">
                {socialLinks.map(({ key, handle, icon: Icon, color, href }) => (
                  <a
                    key={key}
                    href={href(handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 shadow-sm transition-colors hover:bg-stone-50"
                  >
                    <Icon style={{ color }} className="h-3.5 w-3.5" />
                    {handle.startsWith("@") ? handle : `@${handle}`}
                  </a>
                ))}
              </motion.div>
            )}
          </motion.section>

          {/*
           * New client callout — always shown, not gated by auth or prior-visit state.
           * Addresses the most common friction point for first-time clients: confusion
           * about why booking isn't instant. Reduces abandoned booking requests.
           * lg:mt-0 removes the top margin on desktop since the hero section is hidden.
           */}
          <div className="mt-8 mb-2 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 lg:mt-0">
            <LuInfo className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="text-sm font-medium text-stone-800">First time? Welcome!</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                All bookings are request-based and personally reviewed by Trini. Once you submit,
                expect a response within 24 hours. A deposit may be required to hold your spot.
              </p>
            </div>
          </div>

          {/* ── Services ── */}
          <section id="services" className="mt-8 lg:pt-0">
            {/*
             * Custom heading here (instead of <SectionHeading>) because we need
             * the lead-time note right-aligned in the same row as the title.
             */}
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-rose-400">
                  Services
                </p>
                <h2 className="font-display text-2xl font-light text-stone-900">
                  Book your appointment
                </h2>
              </div>
              {/* Soft expectation-setter — reduces last-minute bookings */}
              <p className="shrink-0 text-[11px] text-stone-400 pb-1">Book 1–2 weeks ahead</p>
            </div>

            {activeCategories.length > 0 ? (
              <Tabs defaultValue={defaultTab}>
                <TabsList
                  variant="line"
                  className="mb-6 w-full justify-start border-b border-stone-200 bg-transparent pb-0"
                >
                  {activeCategories.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const Icon = meta.icon;
                    return (
                      <TabsTrigger
                        key={cat}
                        value={cat}
                        className={`shrink-0 gap-1.5 px-3 pb-3 ${meta.tabActive}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                        <span className="text-sm">{meta.shortLabel}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {activeCategories.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const catServices = services.filter((s) => s.category === cat);
                  return (
                    <TabsContent key={cat} value={cat} className="mt-0">
                      {/* Category description — one sentence that explains the service type */}
                      <p className="mb-4 text-sm text-stone-500 leading-relaxed">
                        {meta.description}
                      </p>
                      {/* Per-category special note (e.g. jewelry permanence warning) */}
                      {meta.note && (
                        <p className="mb-4 text-xs text-stone-400 italic">{meta.note}</p>
                      )}
                      <div className="flex flex-col gap-3">
                        {catServices.map((service, index) => (
                          <ServiceCard
                            key={service.id}
                            service={service}
                            meta={meta}
                            addOns={addOnsByService[service.id] ?? []}
                            /*
                             * "Most popular" is awarded to the first service in a category
                             * only when there are multiple services. The admin controls which
                             * service comes first via sort_order in the onboarding step.
                             * Phase 2: replace with booking count from the bookings table.
                             */
                            isPopular={index === 0 && catServices.length > 1}
                          />
                        ))}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <p className="text-sm text-stone-400">No services available at this time.</p>
            )}
          </section>

          <Separator className="my-10" />

          {/* ── Gallery — placeholder until Supabase Storage integration ── */}
          <section>
            <SectionHeading eyebrow="Portfolio" title="Our work" />
            {/*
             * Masonry-style grid using CSS Grid with named row heights.
             * Phase 2: swap placeholder divs for <Image> elements sourced from
             * the `media` table (Supabase Storage bucket: "portfolio").
             */}
            <div
              className="mb-4 grid grid-cols-3 gap-2 overflow-hidden rounded-2xl"
              style={{ gridTemplateRows: "140px 100px" }}
            >
              <div className="col-span-2 row-span-1 flex items-center justify-center bg-rose-50">
                <LuCamera className="h-6 w-6 text-rose-200" />
              </div>
              <div className="col-span-1 row-span-2 flex items-center justify-center bg-amber-50">
                <LuCamera className="h-6 w-6 text-amber-200" />
              </div>
              <div className="flex items-center justify-center bg-violet-50">
                <LuCamera className="h-5 w-5 text-violet-200" />
              </div>
              <div className="flex items-center justify-center bg-teal-50">
                <LuCamera className="h-5 w-5 text-teal-200" />
              </div>
            </div>
            <p className="mb-3 text-center text-xs text-stone-400">
              Portfolio photos coming soon — follow us for our latest work
            </p>
            {instagramHandle && (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white py-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
              >
                <LuInstagram className="h-4 w-4 text-rose-500" />@{instagramHandle}
              </a>
            )}
          </section>

          {/* ── Reviews — only rendered when featured reviews exist ── */}
          {featuredReviews.length > 0 && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="Client Love" title="What they're saying" />
                <div className="flex flex-col gap-4">
                  {featuredReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </section>
            </>
          )}

          <Separator className="my-10" />

          {/* ── About ── */}
          <section>
            <SectionHeading eyebrow="About" title={`Meet ${studio.firstName}`} />
            <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-100">
              {/* Decorative blur circle — pure CSS, no JS */}
              <div className="absolute top-0 right-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-rose-50/60" />
              <div className="relative flex gap-4">
                <Avatar className="h-12 w-12 shrink-0 ring-2 ring-rose-100">
                  <AvatarImage src={studio.avatarUrl ?? undefined} alt={studio.firstName} />
                  <AvatarFallback className="bg-rose-50 text-sm font-semibold text-rose-400">
                    {studio.firstName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-stone-900">{studio.firstName}</p>
                  {locationLabel && <p className="text-xs text-stone-400">{locationLabel}</p>}
                </div>
              </div>
              <p className="relative mt-4 text-sm leading-relaxed text-stone-600">
                {studio.bio ||
                  `Hi, I'm ${studio.firstName} — welcome to ${studio.name}. Every appointment is personalized to you.`}
              </p>
              <div className="relative mt-4 flex flex-wrap gap-2">
                {["Lash Certified", "Permanent Jewelry", "Crochet Styles", "Consulting"].map(
                  (tag) => (
                    <Badge key={tag} variant="outline" className="text-stone-500">
                      <LuSparkles className="h-3 w-3 text-rose-400" />
                      {tag}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          </section>

          <Separator className="my-10" />

          {/* ── How it works ── */}
          <section>
            <SectionHeading eyebrow="Process" title="How it works" />
            <div className="flex flex-col gap-3">
              {HOW_IT_WORKS.map((item, i) => (
                /*
                 * whileInView fires the animation only once when the element
                 * enters the viewport — viewport: { once: true } prevents re-firing
                 * when the user scrolls back up.
                 */
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100"
                >
                  <span className="font-display mt-0.5 text-2xl font-light leading-none text-rose-200">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-medium text-stone-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-stone-500">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Rewards — gated on studio.rewardsEnabled ── */}
          {studio.rewardsEnabled && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="Loyalty" title="Earn rewards" />
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-rose-50 p-6 ring-1 ring-amber-100">
                  <div className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-100/40" />
                  <div className="relative flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                      <LuGift className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-stone-900">Earn points with every visit</p>
                      <p className="mt-1 text-sm text-stone-600">
                        Collect points on every service and redeem them for discounts, free add-ons,
                        and exclusive perks. The more you visit, the more you earn.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["Points per dollar", "Birthday bonus", "Referral rewards"].map((perk) => (
                          <Badge
                            key={perk}
                            variant="outline"
                            className="border-amber-200 text-stone-500"
                          >
                            <LuSparkles className="h-3 w-3 text-amber-500" />
                            {perk}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Referral — always shown; drives organic growth via share link ── */}
          <Separator className="my-10" />
          <section>
            <SectionHeading eyebrow="Spread the love" title="Share with a friend" />
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 p-6 ring-1 ring-rose-100">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                  <LuUsers className="h-5 w-5 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-900">Refer a friend, earn a reward</p>
                  <p className="mt-1 mb-4 text-sm text-stone-600">
                    Know someone who would love {studio.name}? Share your link — both of you get
                    love when they book their first session.
                  </p>
                  <CopyLinkButton slug={slug} instagramHandle={instagramHandle} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Policies — gated on at least one fee/window being configured ── */}
          {hasPolicies && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="Policies" title="Good to know" />
                <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
                  {/*
                   * "Approval-based booking" is always shown when the Policies section
                   * renders — it's a core truth about how Trini runs her studio,
                   * regardless of which fee fields are configured.
                   */}
                  <div className="flex items-start gap-3 p-4">
                    <LuCalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <div>
                      <p className="text-sm font-medium text-stone-800">Approval-based booking</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        All bookings are reviewed and confirmed by Trini. You&apos;ll hear back
                        within 24 hours of submitting your request.
                      </p>
                    </div>
                  </div>

                  {studio.policies.cancellationWindowHours !== null && (
                    <div className="flex items-start gap-3 p-4">
                      <LuShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          {studio.policies.cancellationWindowHours}-hour cancellation policy
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          Please cancel at least {studio.policies.cancellationWindowHours} hours
                          before your appointment to avoid a fee.
                          {studio.policies.cancellationFeeInCents
                            ? ` A ${formatPrice(studio.policies.cancellationFeeInCents)} fee applies for late cancellations.`
                            : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {studio.policies.noShowFeeInCents !== null && (
                    <div className="flex items-start gap-3 p-4">
                      <LuShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div>
                        <p className="text-sm font-medium text-stone-800">No-show fee</p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          A {formatPrice(studio.policies.noShowFeeInCents)} fee applies for missed
                          appointments without notice.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── FAQ — populated from intake.prep text per category ── */}
          {faqItems.length > 0 && (
            <>
              <Separator className="my-10" />
              <section>
                <SectionHeading eyebrow="FAQ" title="Prep & questions" />
                {/*
                 * ShadCN Accordion with type="single" collapsible — one item open at a
                 * time. Radix handles keyboard navigation and ARIA attributes automatically.
                 */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
                  <Accordion type="single" collapsible className="px-4">
                    {faqItems.map((item, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-sm font-medium text-stone-800 hover:no-underline">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm leading-relaxed text-stone-500">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </section>
            </>
          )}

          {/* ── Contact CTA ── */}
          <Separator className="my-10" />
          <section className="py-2 text-center">
            <SectionHeading eyebrow="Questions?" title="Get in touch" />
            <p className="mx-auto mb-6 max-w-xs text-sm text-stone-500">
              Not sure which service is right for you? Send a message before booking — we&apos;re
              happy to help.
            </p>
            {instagramHandle ? (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-95"
              >
                <LuMessageCircle className="h-4 w-4" />
                Message on Instagram
              </a>
            ) : (
              <p className="text-xs text-stone-400">Reach out via DM to get started.</p>
            )}
          </section>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-200 bg-white py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 text-center">
          <TCLogo size={28} className="text-stone-300" />
          <p className="text-xs text-stone-400">© T Creative Studio</p>
          <Link
            href="/"
            className="text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
          >
            tcreative.studio
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SectionHeading                                                      */
/* ------------------------------------------------------------------ */

/**
 * SectionHeading — reusable two-line section label pattern.
 *
 * @param eyebrow - Small uppercase label above the title (e.g. "Services", "FAQ").
 * @param title - Main h2 text in display font.
 */
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-rose-400">
        {eyebrow}
      </p>
      <h2 className="font-display text-2xl font-light text-stone-900">{title}</h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ServiceCard                                                         */
/* ------------------------------------------------------------------ */

/**
 * ServiceCard — displays a single bookable service with its add-ons and CTAs.
 *
 * ## CTA design decision: dual-button (Book + Waitlist)
 * Both "Book this service" and "Waitlist" are always shown side by side.
 * The waitlist is a slot-level concept (a specific time fills up, not an entire
 * category), so it would be wrong to replace the primary CTA based on a category
 * flag. Clients should always be able to attempt booking AND signal waitlist interest.
 *
 * Phase 2: the "Book" button will open a calendar modal showing real availability.
 * When a slot is selected and shown as full, the "Book" button grays out for that
 * slot and "Waitlist" becomes the primary action — all within the modal, not here.
 *
 * ## "Most popular" badge
 * Awarded to `index === 0` in a category with multiple services. Admin-controlled
 * via the sort_order field set during the services step of onboarding.
 *
 * @param service - The service data from the `services` table.
 * @param meta - Category display config (colors, border) from CATEGORY_META.
 * @param addOns - Pre-filtered add-ons for this service from `addOnsByService[service.id]`.
 * @param isPopular - Whether to show the "Most popular" flame badge.
 */
function ServiceCard({
  service,
  meta,
  addOns,
  isPopular,
}: {
  service: Service;
  meta: { color: string; bg: string; border: string };
  addOns: ServiceAddOn[];
  isPopular: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-100 border-l-4 ${meta.border} bg-white p-5 shadow-sm transition-shadow hover:shadow-md`}
    >
      {/* Name row — badge only renders when isPopular is true */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-stone-900">{service.name}</p>
            {isPopular && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-500 ring-1 ring-rose-100">
                <LuFlame className="h-2.5 w-2.5" />
                Most popular
              </span>
            )}
          </div>
          {service.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{service.description}</p>
          )}
        </div>
        <p className={`shrink-0 text-base font-semibold ${meta.color}`}>
          {formatPrice(service.priceInCents)}
        </p>
      </div>

      {/* Metadata chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {service.durationMinutes && (
          <Badge variant="outline" className="text-stone-500">
            <LuClock className="h-3 w-3" />
            {service.durationMinutes} min
          </Badge>
        )}
        {service.depositInCents && (
          <Badge variant="outline" className="text-stone-500">
            {formatPrice(service.depositInCents)} deposit to hold
          </Badge>
        )}
      </div>

      {/* Add-ons — only rendered when this service has active add-ons */}
      {addOns.length > 0 && (
        <div className="mb-4 border-t border-stone-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Add-ons
          </p>
          <div className="flex flex-col gap-1.5">
            {addOns.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center justify-between text-xs text-stone-500"
              >
                <span>
                  {addon.name}
                  {/* Only show duration modifier when it's non-zero */}
                  {addon.additionalMinutes > 0 && (
                    <span className="ml-1 text-stone-400">+{addon.additionalMinutes}min</span>
                  )}
                </span>
                <span className="font-medium text-stone-700">
                  +{formatPrice(addon.priceInCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
       * Dual CTA row — Book (primary, flex-1) + Waitlist (secondary, fixed width).
       * Phase 2: onClick handlers open the booking/waitlist modal instead of alert().
       */}
      <div className="flex gap-2">
        <button
          onClick={() => alert("Booking calendar coming soon!")}
          className="flex-1 rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 active:scale-[0.98]"
        >
          Book this service
        </button>
        <button
          onClick={() => alert("Waitlist sign-up coming soon!")}
          className="rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-medium text-stone-500 transition-colors hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98]"
          title="Join the waitlist for this service"
        >
          Waitlist
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CopyLinkButton                                                      */
/* ------------------------------------------------------------------ */

/**
 * CopyLinkButton — copies the studio's booking URL to the clipboard.
 *
 * Uses `navigator.clipboard.writeText` (async, requires HTTPS or localhost).
 * Shows a check icon for 2 seconds after a successful copy, then resets.
 * Fully self-contained with its own `copied` state — no prop drilling needed.
 *
 * Phase 2: the URL can be personalised with a referral code appended as a
 * query param (e.g. `?ref=CLIENT_ID`) to track referred bookings.
 *
 * @param slug - The studio's URL slug, used to construct the full booking URL.
 * @param instagramHandle - If present, renders a second "Share on Instagram" link.
 */
function CopyLinkButton({
  slug,
  instagramHandle,
}: {
  slug: string;
  instagramHandle: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `https://tcreativestudio.com/book/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-95"
      >
        {copied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy booking link"}
      </button>
      {instagramHandle && (
        <a
          href={`https://instagram.com/${instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          <LuInstagram className="h-4 w-4 text-rose-500" />
          Share on Instagram
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ReviewCard                                                          */
/* ------------------------------------------------------------------ */

/**
 * StarRating — renders 1–5 filled/empty star icons.
 * Filled stars use amber-400; empty stars render in stone-200 to avoid
 * the visual weight of a full-width row of unfilled circles.
 *
 * @param rating - Integer from 1 to 5.
 */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <LuStar
          key={star}
          className={`h-3.5 w-3.5 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-stone-200"}`}
        />
      ))}
    </div>
  );
}

/**
 * ReviewCard — displays a single approved + featured client review.
 * Avatar shows the client's first initial as a fallback (no client photos stored).
 *
 * @param review - A single FeaturedReview from the `reviews` table.
 */
function ReviewCard({ review }: { review: FeaturedReview }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-rose-50 text-xs font-semibold text-rose-400">
              {review.clientFirstName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-stone-800">{review.clientFirstName}</p>
            {review.serviceName && <p className="text-xs text-stone-400">{review.serviceName}</p>}
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>
      {review.body && (
        <p className="text-sm leading-relaxed text-stone-600">&ldquo;{review.body}&rdquo;</p>
      )}
    </div>
  );
}
