"use client";

/**
 * AdminDashboard — the landing page for the admin portal (/admin).
 *
 * ## Responsibility
 * Renders the admin's home base after they complete onboarding. All data is
 * fetched server-side in `app/admin/page.tsx` and passed as props — this
 * component is purely presentational (no data fetching, no server calls).
 *
 * ## Sections
 * 1. **Header** — greeting ("Hey, Trini."), "Live" pulsing badge
 * 2. **Booking link card** — shows `tcreative.studio/book/<slug>` with a
 *    copy button; `toSlug()` mirrors the same transform used in StepComplete
 *    and PanelAdminComplete
 * 3. **Setup checklist** — 5 items derived from props, with an animated
 *    progress bar showing how many are complete
 * 4. **"Do these next" grid** — 4 action cards linking to services, booking
 *    link sharing, team invites, and Square integration
 * 5. **Settings shortcut** — small footer link to /admin/settings
 *
 * ## Animation
 * Uses a local `stagger` + `fadeUp` variant pair (same pattern as the Panel
 * components) so each section cascades in on mount.
 *
 * ## Props
 * @prop firstName - used for the personalized greeting
 * @prop studioName - used to derive the booking URL slug (via `toSlug()`)
 * @prop locationArea - shown in the setup checklist ("Where you work")
 * @prop socialCount - number of connected social accounts (0 = not done)
 * @prop hasPolicies - true if at least one cancellation or no-show fee is set
 * @prop hasDeposits - true if at least one service has a deposit amount
 */
import { motion } from "framer-motion";
import {
  LuCalendarCheck,
  LuLink,
  LuUserPlus,
  LuSettings,
  LuCreditCard,
  LuShare2,
  LuCopy,
  LuArrowRight,
} from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";

interface Props {
  firstName: string;
  studioName: string | null;
  locationArea: string | null;
  socialCount: number;
  hasPolicies: boolean;
  hasDeposits: boolean;
}

function toSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "") || "tcreativestudio";
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export function AdminDashboard({
  firstName,
  studioName,
  locationArea,
  socialCount,
  hasPolicies,
  hasDeposits,
}: Props) {
  const slug = toSlug(studioName ?? "");
  const bookingUrl = `tcreative.studio/book/${slug}`;

  const setupItems = [
    {
      done: !!studioName,
      label: "Studio profile",
      desc: studioName ?? "Name and bio",
    },
    {
      done: !!locationArea,
      label: "Location",
      desc: locationArea ?? "Where you work",
    },
    {
      done: socialCount > 0,
      label: "Social links",
      desc: socialCount > 0 ? `${socialCount} connected` : "Instagram, TikTok…",
    },
    {
      done: hasPolicies,
      label: "Booking policies",
      desc: hasPolicies ? "Cancellation & no-show fees set" : "Fees & cancellation",
    },
    {
      done: hasDeposits,
      label: "Deposits",
      desc: hasDeposits ? "Deposit amounts set" : "Protect your time",
    },
  ];

  const completedCount = setupItems.filter((i) => i.done).length;
  const allDone = completedCount === setupItems.length;

  const nextSteps = [
    {
      icon: LuCalendarCheck,
      label: "Add your first service",
      desc: "Lash set, jewelry session, or crochet install — once it's live, clients can book it.",
      href: "/admin/services",
      color: "text-rose-400",
      bg: "bg-rose-400/10",
    },
    {
      icon: LuShare2,
      label: "Drop your booking link",
      desc: "Paste it in your Instagram bio. That's your storefront.",
      href: "#booking-link",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: LuUserPlus,
      label: "Invite an assistant",
      desc: "Send an invite from settings. They'll set up their own profile.",
      href: "/admin/team",
      color: "text-violet-400",
      bg: "bg-violet-400/10",
    },
    {
      icon: LuCreditCard,
      label: "Connect Square",
      desc: "Accept payments, collect deposits, and charge no-shows automatically.",
      href: "/admin/settings/integrations",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-2xl mx-auto space-y-8"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TCLogo size={18} className="text-accent" />
              <span className="text-xs font-semibold text-muted/50 uppercase tracking-wider">
                Admin Dashboard
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground">
              {firstName ? `Hey, ${firstName}.` : "Welcome back."}
            </h1>
            <p className="text-muted text-base mt-1">
              {allDone
                ? "Your studio is fully set up. Here's your home base."
                : "Your studio is live. A few things left to finish."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0 mt-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">
              Live
            </span>
          </div>
        </motion.div>

        {/* Booking link card */}
        <motion.div
          variants={fadeUp}
          id="booking-link"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-foreground/8"
        >
          <div className="w-8 h-8 rounded-xl bg-accent/12 flex items-center justify-center shrink-0">
            <LuLink className="text-accent" style={{ width: 15, height: 15 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-0.5">
              Your booking link
            </p>
            <p className="text-sm font-mono text-foreground/80 truncate">
              tcreative.studio/book/<span className="text-accent font-semibold">{slug}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`https://${bookingUrl}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-accent border border-accent/20 hover:bg-accent/8 transition-colors shrink-0"
          >
            <LuCopy style={{ width: 11, height: 11 }} />
            Copy
          </button>
        </motion.div>

        {/* Setup checklist */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider">
              Setup — {completedCount}/{setupItems.length}
            </p>
            <div className="flex-1 mx-4 h-1 rounded-full bg-foreground/6 overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / setupItems.length) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
              />
            </div>
            {allDone && (
              <span className="text-[10px] font-semibold text-emerald-500">Complete ✓</span>
            )}
          </div>
          <div className="space-y-1.5">
            {setupItems.map(({ done, label, desc }) => (
              <div
                key={label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200
                  ${done ? "bg-surface border-foreground/8" : "bg-foreground/2 border-foreground/5"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
                    ${done ? "bg-emerald-500/15 text-emerald-500" : "bg-foreground/6 text-foreground/20"}`}
                >
                  {done ? "✓" : "○"}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold leading-tight ${done ? "text-foreground" : "text-foreground/50"}`}
                  >
                    {label}
                  </p>
                  <p className="text-[11px] text-muted/50 truncate">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Next steps */}
        <motion.div variants={fadeUp}>
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">
            Do these next
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {nextSteps.map(({ icon: Icon, label, desc, href, color, bg }) => (
              <a
                key={label}
                href={href}
                className="group flex items-start gap-3 px-4 py-3 rounded-2xl bg-surface border border-foreground/6 hover:border-foreground/15 transition-all duration-200"
              >
                <div
                  className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}
                >
                  <Icon className={color} style={{ width: 15, height: 15 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-[11px] text-muted/55 mt-0.5 leading-snug">{desc}</p>
                </div>
                <LuArrowRight
                  className="text-foreground/20 group-hover:text-foreground/40 transition-colors shrink-0 mt-1"
                  style={{ width: 14, height: 14 }}
                />
              </a>
            ))}
          </div>
        </motion.div>

        {/* Settings shortcut */}
        <motion.div variants={fadeUp} className="flex items-center gap-2 px-1">
          <LuSettings className="w-3.5 h-3.5 text-muted/30 shrink-0" />
          <p className="text-xs text-muted/40">
            Square and Zoho connect from{" "}
            <a href="/admin/settings" className="text-accent hover:underline">
              Settings
            </a>
            . You can also manage team members and adjust policies there.
          </p>
        </motion.div>
      </motion.div>
    </main>
  );
}
