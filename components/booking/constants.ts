/**
 * components/booking/constants.ts — Static display configuration for the booking storefront.
 *
 * ## Why a separate constants file?
 * The constants in this file are referenced by multiple components in the booking tree
 * (BookingPage, the ServiceCard tab list, the FAQ builder). Extracting them prevents
 * circular imports and keeps individual component files lean.
 *
 * ## CATEGORY_META design note
 * `satisfies` (not `as`) is used so TypeScript infers the literal types of `icon`,
 * `color`, etc. while still enforcing the shape against the union key. This means
 * `CATEGORY_META.lash.icon` is typed as `typeof LuEye`, not the wider
 * `React.ComponentType<{ className?: string }>`.
 */

import { LuEye, LuGem, LuScissors, LuLightbulb, LuPrinter, LuSparkles } from "react-icons/lu";

/** Ordered list of service categories rendered as tabs on the booking page. */
export const CATEGORIES = [
  "lash",
  "jewelry",
  "crochet",
  "consulting",
  "3d_printing",
  "aesthetics",
] as const;

/** Union of the four supported category slugs. */
export type CategorySlug = (typeof CATEGORIES)[number];

/**
 * CATEGORY_META — static display configuration per service category.
 *
 * Centralises all category-specific UI decisions in one place so that adding
 * a new category only requires adding an entry here — no changes needed in the
 * rendering logic.
 */
export const CATEGORY_META = {
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
      "Handmade crocheted stuffed animals, amigurumi, and custom plushies. Each piece is one-of-a-kind.",
    note: null,
    faqQuestion: "How long does a custom crochet order take?",
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
  "3d_printing": {
    label: "3D Printing",
    shortLabel: "3D Print",
    description:
      "Custom 3D-printed accessories, décor, and beauty tools made to order. From concept to creation.",
    note: null,
    faqQuestion: "How does the 3D printing process work?",
    icon: LuPrinter,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-l-purple-400",
    tabActive: "data-[state=active]:text-purple-600",
  },
  aesthetics: {
    label: "Aesthetics",
    shortLabel: "Aesthetics",
    description:
      "Skincare treatments, facials, and beauty enhancements for a refreshed, glowing look.",
    note: null,
    faqQuestion: "How should I prepare for my aesthetics appointment?",
    icon: LuSparkles,
    color: "text-pink-600",
    bg: "bg-pink-50",
    border: "border-l-pink-400",
    tabActive: "data-[state=active]:text-pink-600",
  },
} satisfies Record<
  CategorySlug,
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
export const LOCATION_LABELS: Record<string, string> = {
  home_studio: "Home Studio",
  salon: "Salon",
  mobile: "Mobile / On-site",
  virtual: "Virtual",
};

/** Static copy for the "How it works" process section. */
export const HOW_IT_WORKS = [
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
] as const;
