"use client";

/**
 * PanelAdminComplete — the right-panel shown on the completion screen for admin users.
 *
 * ## Purpose
 * After the admin clicks "Launch my studio" and their data is saved, the
 * OnboardingShell switches to the completion state. This panel is the visual
 * confirmation that everything is live and ready.
 *
 * ## Sections
 * 1. **Studio live header** — TCLogo, studio name, "Admin dashboard" label,
 *    and a pulsing "Live" badge with an animated green dot.
 * 2. **"Active now" 2×2 grid** — four feature cards (Booking page, Notifications,
 *    Payments, Client CRM) each marked "✓ Ready".
 * 3. **Booking link card** — the admin's unique booking URL with a copy icon.
 *    `toSlug()` mirrors the transform used in StepComplete and AdminDashboard.
 * 4. **"Do these first" action plan** — a numbered 3-step list:
 *    01. Add first service
 *    02. Drop booking link in bio
 *    03. Invite first assistant
 * 5. **Footer** — a one-liner about Square/Zoho integration and the dashboard.
 *
 * ## Props
 * @prop studioName - used to derive the booking URL slug via `toSlug()`
 */
import { motion } from "framer-motion";
import {
  LuCalendarCheck,
  LuLink,
  LuUserPlus,
  LuBell,
  LuCreditCard,
  LuUsers,
  LuLayoutDashboard,
  LuCopy,
} from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";
import { fadeUp, stagger } from "./shared";

const LIVE_NOW = [
  { icon: LuCalendarCheck, label: "Booking page", color: "text-rose-400", bg: "bg-rose-400/12" },
  { icon: LuBell, label: "Notifications", color: "text-accent", bg: "bg-accent/12" },
  { icon: LuCreditCard, label: "Payments", color: "text-emerald-500", bg: "bg-emerald-500/12" },
  { icon: LuUsers, label: "Client CRM", color: "text-violet-400", bg: "bg-violet-400/12" },
];

const NEXT_STEPS = [
  {
    step: "01",
    icon: LuCalendarCheck,
    label: "Add your first service",
    desc: "Create a lash set, jewelry session, or crochet install — the moment it's live, clients can book it.",
    accent: "text-rose-400",
    bg: "bg-rose-400/15",
  },
  {
    step: "02",
    icon: LuLink,
    label: "Drop your booking link in your bio",
    desc: "Settings → copy your link → paste in each Instagram bio. Done.",
    accent: "text-accent",
    bg: "bg-accent/12",
  },
  {
    step: "03",
    icon: LuUserPlus,
    label: "Invite your first assistant",
    desc: "Send an invite from your dashboard. They set up their own profile.",
    accent: "text-violet-400",
    bg: "bg-violet-400/15",
  },
];

interface Props {
  studioName?: string;
}

function toSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "") || "tcreativestudio";
}

export function PanelAdminComplete({ studioName }: Props) {
  const bookingSlug = toSlug(studioName ?? "");
  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] space-y-2.5"
      >
        {/* Studio live header */}
        <motion.div variants={fadeUp} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent/8 border border-accent/15 flex items-center justify-center">
                <TCLogo size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-none">
                  T Creative Studio
                </p>
                <p className="text-xs text-muted/50 mt-0.5">Admin dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
              Everything&apos;s ready
            </p>
            <h2 className="text-xl font-semibold text-foreground leading-tight">
              Your studio is open for business.
            </h2>
          </div>
        </motion.div>

        {/* What's live now — 2×2 grid */}
        <motion.div variants={fadeUp}>
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1.5">
            Active now
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {LIVE_NOW.map(({ icon: Icon, label, color, bg }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-surface border border-foreground/6"
              >
                <div
                  className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={color} style={{ width: 12, height: 12 }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">✓ Ready</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Booking link card */}
        <motion.div variants={fadeUp}>
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1.5">
            Your booking link
          </p>
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface border border-foreground/8">
            <div className="w-6 h-6 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
              <LuLink className="text-accent" style={{ width: 12, height: 12 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-foreground/80 truncate">
                tcreative.studio/book/
                <span className="text-accent font-semibold">{bookingSlug}</span>
              </p>
              <p className="text-[10px] text-muted/50">Share this in your Instagram bio</p>
            </div>
            <div className="w-6 h-6 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 cursor-pointer hover:bg-foreground/8 transition-colors">
              <LuCopy className="text-muted/50" style={{ width: 11, height: 11 }} />
            </div>
          </div>
        </motion.div>

        {/* Action plan */}
        <motion.div variants={fadeUp}>
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1.5">
            Do these first
          </p>
          <div className="space-y-1.5">
            {NEXT_STEPS.map(({ step, icon: Icon, label, desc, accent, bg }) => (
              <div
                key={step}
                className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-surface border border-foreground/6"
              >
                <div
                  className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}
                >
                  <Icon className={accent} style={{ width: 12, height: 12 }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-bold text-muted/30">{step}</span>
                    <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                  </div>
                  <p className="text-[11px] text-muted/55 mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fadeUp} className="flex items-center gap-2 px-1">
          <LuLayoutDashboard className="w-3 h-3 text-muted/30 shrink-0" />
          <p className="text-xs text-muted/40 leading-relaxed">
            Square &amp; Zoho connect from Settings. Your full dashboard is on the other side.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
