"use client";

/**
 * PanelAdminStudio — the right-panel for step 4 (admin studio step).
 *
 * ## Purpose
 * Shows a live preview of the admin's public booking page as they fill in their
 * studio name, bio, and location. Every field updates instantly so the admin can
 * see exactly what clients will see before they ever publish.
 *
 * ## Sections
 * 1. **Live booking page preview** — a mock "browser card" containing:
 *    - Studio name + bio (falls back to "Add a bio above…" placeholder)
 *    - Location type icon + label + area (e.g. "Home studio · Brickell, Miami")
 *    - Booking URL derived from `toSlug(studio.name)`
 *    - All 4 service icons (static — doesn't depend on which services are enabled)
 *    - A "Book a session" CTA button
 * 2. **Location insight** — a tip that changes based on `locationType` (home studio,
 *    salon suite, or mobile). Explains to the admin why their location type matters.
 * 3. **Client experience flow** — a 3-step mini-diagram (Click link → Pick a service
 *    → Confirmed email) to show what clients go through.
 * 4. **Square receipt note** — shows how the studio name appears on a payment receipt.
 *
 * ## Reactivity
 * The `studio` prop is derived from live form values in OnboardingFlow.
 * Every keystroke in StepAdminStudio re-renders this panel with updated content.
 *
 * ## Props
 * @prop studio.name - studio name (determines the booking URL slug and display name)
 * @prop studio.bio - optional bio text
 * @prop studio.locationType - "home_studio" | "salon_suite" | "mobile"
 * @prop studio.locationArea - freeform area text (neighborhood, city, etc.)
 */
import { motion } from "framer-motion";
import {
  LuSparkles,
  LuGem,
  LuScissors,
  LuLightbulb,
  LuCalendar,
  LuMail,
  LuCreditCard,
  LuLink,
  LuHouse,
  LuBuilding,
  LuMapPin,
  LuMousePointerClick,
  LuArrowRight,
} from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";
import { fadeUp, stagger } from "./shared";

const SERVICES = [
  { icon: LuSparkles, name: "Lash Extensions" },
  { icon: LuGem, name: "Permanent Jewelry" },
  { icon: LuScissors, name: "Crochet" },
  { icon: LuLightbulb, name: "Consulting" },
];

const LOCATION_META = {
  home_studio: {
    icon: LuHouse,
    label: "Home studio",
    tip: "Clients know exactly where they're heading. Clear location = fewer 'where are you?' texts on appointment day.",
  },
  salon_suite: {
    icon: LuBuilding,
    label: "Salon suite",
    tip: "Clients see your suite details before they book — they'll arrive calm and confident, not lost in a parking lot.",
  },
  mobile: {
    icon: LuMapPin,
    label: "Travels to clients",
    tip: "Clients in your coverage area know you come to them — perfect for pop-ups, events, or at-home sessions.",
  },
} as const;

interface Props {
  studio: {
    name: string;
    bio: string;
    locationType: "home_studio" | "salon_suite" | "mobile";
    locationArea: string;
  };
}

function toSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "") || "tcreativestudio";
}

export function PanelAdminStudio({ studio }: Props) {
  const displayName = studio.name.trim() || "T Creative Studio";
  const bookingUrl = `tcreative.app/book/${toSlug(studio.name)}`;
  const displayBio = studio.bio.trim();
  const locMeta = LOCATION_META[studio.locationType ?? "home_studio"];
  const LocationIcon = locMeta.icon;
  const locationLabel = studio.locationArea.trim()
    ? `${locMeta.label} · ${studio.locationArea.trim()}`
    : locMeta.label;

  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] space-y-3"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            Your booking page
          </p>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            Here&apos;s what clients see.
          </h2>
          <p className="text-sm text-muted mt-1 leading-snug">
            Your name, bio, and location appear on your booking page, every confirmation email, and
            every Square receipt.
          </p>
        </motion.div>

        {/* Live booking page preview */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden"
        >
          <div className="px-3 py-1 border-b border-foreground/6 bg-foreground/2">
            <p className="text-[10px] font-semibold text-muted/40 uppercase tracking-wider">
              Booking page · Live preview
            </p>
          </div>

          {/* Name + bio */}
          <div className="px-3 pt-2.5 pb-2 border-b border-foreground/6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <TCLogo size={18} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">
                  {displayName}
                </p>
                {displayBio ? (
                  <p className="text-[11px] text-muted/60 mt-0.5 line-clamp-1">{displayBio}</p>
                ) : (
                  <p className="text-[11px] text-muted/25 mt-0.5 italic">Add a bio above…</p>
                )}
              </div>
            </div>
          </div>

          {/* Location + URL combined row */}
          <div className="px-3 py-1.5 border-b border-foreground/6 space-y-1">
            <div className="flex items-center gap-1.5">
              <LocationIcon className="w-2.5 h-2.5 text-muted/45 shrink-0" />
              <span className="text-[10px] text-muted/65 truncate">{locationLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <LuLink className="w-2.5 h-2.5 text-accent shrink-0" />
              <span className="text-[10px] text-accent font-medium truncate">{bookingUrl}</span>
            </div>
          </div>

          {/* Services */}
          <div className="px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 border-b border-foreground/6">
            {SERVICES.map(({ icon: Icon, name }) => (
              <div key={name} className="flex items-center gap-1">
                <Icon className="w-2.5 h-2.5 text-muted/35 shrink-0" />
                <span className="text-[10px] text-muted/55">{name}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-3 py-2">
            <div className="w-full h-7 rounded-lg bg-accent/12 flex items-center justify-center gap-1.5">
              <LuCalendar className="w-2.5 h-2.5 text-accent" />
              <span className="text-[11px] text-accent font-semibold">Book a session</span>
            </div>
          </div>
        </motion.div>

        {/* Location insight — changes live */}
        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-surface border border-foreground/6">
            <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <LocationIcon className="text-accent" style={{ width: 12, height: 12 }} />
            </div>
            <p className="text-xs text-muted/70 leading-relaxed">{locMeta.tip}</p>
          </div>
        </motion.div>

        {/* What clients experience */}
        <motion.div variants={fadeUp} className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted/40 uppercase tracking-wider">
            What clients experience
          </p>
          <div className="flex items-stretch gap-1.5">
            {/* Step 1 */}
            <div className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-surface border border-foreground/6 text-center">
              <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <LuMousePointerClick className="text-accent" style={{ width: 12, height: 12 }} />
              </div>
              <p className="text-[11px] font-semibold text-foreground/70 leading-tight">
                Click your link
              </p>
              <p className="text-[10px] text-muted/45 leading-snug">Name, bio &amp; location</p>
            </div>
            <div className="flex items-center self-center shrink-0">
              <LuArrowRight className="w-2.5 h-2.5 text-muted/25" />
            </div>
            {/* Step 2 */}
            <div className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-surface border border-foreground/6 text-center">
              <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <LuCalendar className="text-accent" style={{ width: 12, height: 12 }} />
              </div>
              <p className="text-[11px] font-semibold text-foreground/70 leading-tight">
                Pick a service
              </p>
              <p className="text-[10px] text-muted/45 leading-snug">Price &amp; deposit shown</p>
            </div>
            <div className="flex items-center self-center shrink-0">
              <LuArrowRight className="w-2.5 h-2.5 text-muted/25" />
            </div>
            {/* Step 3 */}
            <div className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-surface border border-foreground/6 text-center">
              <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <LuMail className="text-accent" style={{ width: 12, height: 12 }} />
              </div>
              <p className="text-[11px] font-semibold text-foreground/70 leading-tight">
                Confirmed
              </p>
              <p className="text-[10px] text-muted/45 leading-snug">
                Email from <span className="text-foreground/55 font-medium">{displayName}</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Your name on receipts */}
        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-surface border border-foreground/6">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <LuCreditCard className="text-emerald-500" style={{ width: 12, height: 12 }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">
                Square payment receipt
              </p>
              <p className="text-xs text-muted/55 mt-0.5 leading-snug">
                &ldquo;Payment to{" "}
                <span className="text-foreground/70 font-medium">{displayName}</span> —
                $120.00&rdquo;
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
