"use client";

/**
 * PanelAdminSocials — the right-panel for step 3 (admin socials step).
 *
 * ## Purpose
 * Visualizes how each connected social account feeds into a single booking
 * page — turning scattered followers across platforms into one unified funnel.
 *
 * ## Sections
 * 1. **Platform pill grid** — all 11 supported platforms rendered as pills.
 *    Connected platforms (those with a value in the `socials` prop) are fully
 *    visible; unconnected platforms are faded to 20% opacity. Updates in
 *    real-time as the user enters handles on the left.
 * 2. **4-step booking funnel** — a static card showing the client journey:
 *    "Discover you → Land on booking page → Book & pay → You get notified"
 *
 * ## Reactivity
 * `PLATFORMS.filter(({ key }) => safe[key])` recalculates on every render.
 * Since the panel re-renders whenever the form values change (driven by
 * OnboardingFlow passing down the live socials object), the pill grid is
 * always in sync with what the user has typed.
 *
 * ## Props
 * @prop socials - the current socials object from the form, keyed by platform
 *   (instagram, instagram2, instagram3, instagram4, tiktok, youtube, pinterest,
 *   facebook, linkedin, google, website). A non-empty string = connected.
 */
import { motion } from "framer-motion";
import {
  FaInstagram,
  FaTiktok,
  FaPinterest,
  FaLinkedinIn,
  FaGoogle,
  FaFacebook,
  FaYoutube,
} from "react-icons/fa";
import { LuGlobe, LuCalendarCheck, LuBellRing, LuArrowRight } from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";
import { fadeUp, stagger } from "./shared";

type Socials = {
  instagram: string;
  instagram2: string;
  instagram3: string;
  instagram4: string;
  tiktok: string;
  facebook: string;
  youtube: string;
  pinterest: string;
  linkedin: string;
  google: string;
  website: string;
};

const PLATFORMS = [
  {
    key: "instagram" as keyof Socials,
    icon: FaInstagram,
    color: "text-pink-500",
    bg: "bg-pink-500/12",
  },
  {
    key: "instagram2" as keyof Socials,
    icon: FaInstagram,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    key: "instagram3" as keyof Socials,
    icon: FaInstagram,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    key: "instagram4" as keyof Socials,
    icon: FaInstagram,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    key: "tiktok" as keyof Socials,
    icon: FaTiktok,
    color: "text-foreground",
    bg: "bg-foreground/8",
  },
  { key: "youtube" as keyof Socials, icon: FaYoutube, color: "text-red-500", bg: "bg-red-500/12" },
  {
    key: "pinterest" as keyof Socials,
    icon: FaPinterest,
    color: "text-rose-600",
    bg: "bg-rose-600/12",
  },
  {
    key: "facebook" as keyof Socials,
    icon: FaFacebook,
    color: "text-blue-500",
    bg: "bg-blue-500/12",
  },
  {
    key: "linkedin" as keyof Socials,
    icon: FaLinkedinIn,
    color: "text-blue-600",
    bg: "bg-blue-600/12",
  },
  {
    key: "google" as keyof Socials,
    icon: FaGoogle,
    color: "text-foreground",
    bg: "bg-foreground/8",
  },
  {
    key: "website" as keyof Socials,
    icon: LuGlobe,
    color: "text-foreground",
    bg: "bg-foreground/8",
  },
] as const;

interface Props {
  socials: Socials;
}

export function PanelAdminSocials({ socials }: Props) {
  const safe = socials ?? ({} as Socials);
  const filled = PLATFORMS.filter(({ key }) => safe[key]);
  const filledCount = filled.length;

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
            Your funnel
          </p>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            Every platform feeds one booking page.
          </h2>
          <p className="text-sm text-muted mt-1 leading-snug">
            Every account you add is another door. They all lead to the same place.
          </p>
        </motion.div>

        {/* Live platform icons — compact pill grid */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-foreground/6">
            <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wider">
              1 · They discover you
              {filledCount > 0 && (
                <span className="ml-1.5 text-accent/60 normal-case font-normal">
                  · {filledCount} connected
                </span>
              )}
            </p>
          </div>
          <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
            {PLATFORMS.map(({ key, icon: Icon, color, bg }) => {
              const val = safe[key];
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] transition-all duration-200 ${
                    val
                      ? "bg-surface border-foreground/12 opacity-100"
                      : "border-transparent opacity-20"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded ${bg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={color} style={{ width: 7, height: 7 }} />
                  </div>
                  {val && (
                    <span className="text-foreground/70 font-medium truncate max-w-[80px]">
                      @{val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Funnel steps — single compact card, 3 rows */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden divide-y divide-foreground/6"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
              <TCLogo size={14} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-accent uppercase tracking-wider">
                2 · They land here
              </p>
              <p className="text-xs font-semibold text-foreground leading-tight mt-0.5">
                Your booking page
              </p>
              <p className="text-[11px] text-muted/60 leading-snug">
                One link. No DMs asking for availability.
              </p>
            </div>
            <LuArrowRight className="w-3 h-3 text-foreground/15 shrink-0" />
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <LuCalendarCheck className="text-emerald-500" style={{ width: 14, height: 14 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
                3 · They book & pay
              </p>
              <p className="text-xs font-semibold text-foreground leading-tight mt-0.5">
                Confirmed and paid — automatically
              </p>
              <p className="text-[11px] text-muted/60 leading-snug">
                Deposit collected upfront. Slot is locked.
              </p>
            </div>
            <LuArrowRight className="w-3 h-3 text-foreground/15 shrink-0" />
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
              <LuBellRing className="text-accent" style={{ width: 14, height: 14 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-accent uppercase tracking-wider">
                4 · You get notified
              </p>
              <p className="text-xs font-semibold text-foreground leading-tight mt-0.5">
                Text and email — instantly
              </p>
              <p className="text-[11px] text-muted/60 leading-snug">
                No missed DMs. Just a paid appointment.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
