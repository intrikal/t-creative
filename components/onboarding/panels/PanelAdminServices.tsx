"use client";

/**
 * PanelAdminServices — the right-panel for step 5 (admin services step).
 *
 * ## Purpose
 * Shows a live preview of the booking page service cards as the admin enables
 * services and sets prices/durations. Includes bonus context cards explaining
 * the booking notice and deposit mechanics.
 *
 * ## Sections
 * 1. **Live service card preview** — a mock "booking page" card that lists only
 *    the enabled services with their duration, price, and deposit (if set).
 *    If no services are enabled, shows an empty state prompt.
 * 2. **Booking notice insight** — shown when `bookingNotice` is non-empty.
 *    Explains that clients must book at least N hours in advance.
 * 3. **Deposit insight** — shown when any enabled service has a deposit amount.
 *    Explains how deposits lock slots and apply toward the total.
 * 4. **"Coming up in step 6" teaser** — shows a preview of the cancellation
 *    and no-show fee cards that will appear in StepAdminPolicies.
 *
 * ## Reactivity
 * `services` and `bookingNotice` are derived from live form values in
 * OnboardingFlow and re-render this panel on every change.
 *
 * ## fmt() helper
 * Converts a total-minutes string (e.g. "90") to a human-readable label
 * (e.g. "1h 30m"). Returns null for zero/empty inputs.
 *
 * ## Props
 * @prop services - map of service key → { enabled, price, duration, deposit }
 * @prop studioName - used in the browser bar of the preview card
 * @prop bookingNotice - minimum advance booking time in hours (as a string)
 */
import { motion } from "framer-motion";
import {
  LuEye,
  LuGem,
  LuScissors,
  LuLightbulb,
  LuCalendar,
  LuShieldCheck,
  LuBanknote,
  LuClock,
} from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";
import { fadeUp, stagger } from "./shared";

type ServiceEntry = { enabled: boolean; price: string; duration: string; deposit: string };
type Services = {
  lash: ServiceEntry;
  jewelry: ServiceEntry;
  crochet: ServiceEntry;
  consulting: ServiceEntry;
};

const SERVICE_META = {
  lash: { icon: LuEye, label: "Lash Extensions", color: "text-rose-400", bg: "bg-rose-400/12" },
  jewelry: {
    icon: LuGem,
    label: "Permanent Jewelry",
    color: "text-amber-400",
    bg: "bg-amber-400/12",
  },
  crochet: { icon: LuScissors, label: "Crochet", color: "text-violet-400", bg: "bg-violet-400/12" },
  consulting: {
    icon: LuLightbulb,
    label: "Consulting",
    color: "text-teal-400",
    bg: "bg-teal-400/12",
  },
} as const;

function fmt(mins: string) {
  const m = parseInt(mins) || 0;
  if (!m) return null;
  const h = Math.floor(m / 60),
    r = m % 60;
  return r > 0 ? `${h}h ${r}m` : h > 0 ? `${h}h` : `${m}m`;
}

interface Props {
  services: Services;
  studioName: string;
  bookingNotice: string;
}

export function PanelAdminServices({ services, studioName, bookingNotice }: Props) {
  const active = services
    ? (Object.entries(services) as [keyof Services, ServiceEntry][]).filter(([, s]) => s.enabled)
    : [];

  const hasDeposit = active.some(([, s]) => s.deposit && parseFloat(s.deposit) > 0);

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
            Booking page · live preview
          </p>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            This is what clients see.
          </h2>
          <p className="text-sm text-muted mt-1 leading-snug">
            Enable a category and it appears here instantly. Your full menu lives in the dashboard.
          </p>
        </motion.div>

        {/* Live service card preview */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden"
        >
          <div className="px-3 py-1.5 border-b border-foreground/6 bg-foreground/2 flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent/15 flex items-center justify-center shrink-0">
              <TCLogo size={10} className="text-accent" />
            </div>
            <span className="text-[10px] text-muted/50 font-medium truncate">
              {studioName || "T Creative Studio"}
            </span>
            <span className="text-[10px] text-muted/30 ml-auto">Live preview</span>
          </div>

          {active.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-xs text-muted/40">Enable a service to see it here</p>
            </div>
          ) : (
            <div className="divide-y divide-foreground/5">
              {active.map(([key, svc]) => {
                const { icon: Icon, label, color, bg } = SERVICE_META[key];
                const duration = fmt(svc.duration);
                const price = svc.price ? `$${svc.price}` : null;
                const deposit = svc.deposit ? `$${svc.deposit} dep` : null;
                return (
                  <div key={key} className="flex items-center gap-3 px-3 py-2">
                    <div
                      className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={color} style={{ width: 13, height: 13 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                      <p className="text-[11px] text-muted/60 mt-0.5">
                        {[duration, price, deposit].filter(Boolean).join(" · ") || "Details TBD"}
                      </p>
                    </div>
                    <div className="w-14 h-6 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
                      <LuCalendar className="w-2.5 h-2.5 text-accent mr-1" />
                      <span className="text-[10px] text-accent font-semibold">Book</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Booking notice */}
        {bookingNotice && (
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface border border-foreground/6">
              <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <LuClock className="text-accent" style={{ width: 12, height: 12 }} />
              </div>
              <p className="text-xs text-foreground/70">
                Clients must book at least{" "}
                <strong className="text-foreground">{bookingNotice}h</strong> in advance — same-day
                requests won&apos;t go through.
              </p>
            </div>
          </motion.div>
        )}

        {/* Deposit insight */}
        {hasDeposit && (
          <motion.div variants={fadeUp}>
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-surface border border-foreground/6">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <LuBanknote className="text-emerald-500" style={{ width: 12, height: 12 }} />
              </div>
              <p className="text-xs text-muted/70 leading-relaxed">
                The deposit locks their slot. It&apos;s applied to their total — clients pay the
                remaining balance day-of via Square.
              </p>
            </div>
          </motion.div>
        )}

        {/* Policies preview — no-show + cancellation */}
        <motion.div variants={fadeUp} className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted/40 uppercase tracking-wider">
            Coming up in step 6
          </p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-surface border border-foreground/6">
              <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <LuShieldCheck className="text-accent" style={{ width: 12, height: 12 }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground/80 leading-tight">
                  Cancellation fee
                </p>
                <p className="text-[11px] text-muted/55 mt-0.5 leading-snug">
                  Charged if a client cancels inside your window — e.g. less than{" "}
                  {bookingNotice || "24"}h notice.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-surface border border-foreground/6">
              <div className="w-6 h-6 rounded-lg bg-rose-400/10 flex items-center justify-center shrink-0 mt-0.5">
                <LuCalendar className="text-rose-400" style={{ width: 12, height: 12 }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground/80 leading-tight">
                  No-show fee
                </p>
                <p className="text-[11px] text-muted/55 mt-0.5 leading-snug">
                  Charged when a client doesn&apos;t show up at all — collected automatically
                  through Square.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
