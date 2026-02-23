"use client";

/**
 * PanelAdminContact — the right-panel for step 2 (admin contact step).
 *
 * ## Purpose
 * Reinforces why the admin should provide their phone number and notification
 * preferences by showing what notifications actually look like in practice.
 *
 * ## Sections
 * 1. **Live activity feed** — a mock feed of 4 events (new booking, Square
 *    payment, etc.) with realistic client names, services, amounts, and
 *    timestamps. The footer shows the day's total revenue.
 * 2. **"Instant alert" connector** — a visual arrow that links "booking happens"
 *    to "you get notified".
 * 3. **Alert channels** — two cards (SMS + email) that update reactively based
 *    on the `contact` prop:
 *    - SMS card turns amber with a warning when `notifySms` is true but no
 *      phone number has been entered yet.
 *    - Email card shows the user's actual email address when `notifyEmail` is true.
 *    - In-app dashboard is always shown as a third channel.
 *
 * ## Reactivity
 * This panel receives the current form state via the `contact` prop so the
 * alert channel cards update in real-time as the user types their phone number
 * and toggles notification preferences in StepAdminContact on the left.
 *
 * ## Props
 * @prop contact.phone - raw digit string (stripped of formatting)
 * @prop contact.email - user's email address
 * @prop contact.notifySms - whether SMS alerts are enabled
 * @prop contact.notifyEmail - whether email notifications are enabled
 */
import { motion } from "framer-motion";
import {
  LuShieldCheck,
  LuBell,
  LuMail,
  LuSmartphone,
  LuTrendingUp,
  LuArrowDown,
} from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

const FEED = [
  {
    dot: "bg-rose-400",
    label: "New booking",
    labelColor: "text-rose-400",
    name: "Keisha J.",
    detail: "Volume Lash Set · Sat, Apr 5 · 1:00 PM",
    amount: "$120",
    time: "Just now",
  },
  {
    dot: "bg-emerald-500",
    label: "Square payment",
    labelColor: "text-emerald-500",
    name: "Aaliyah M.",
    detail: "Permanent Jewelry · Paid via Square",
    amount: "$85",
    time: "3 min ago",
  },
  {
    dot: "bg-violet-400",
    label: "New booking",
    labelColor: "text-violet-400",
    name: "Monique C.",
    detail: "Butterfly Braid Install · Sun, Apr 6",
    amount: "$150",
    time: "18 min ago",
  },
  {
    dot: "bg-teal-400",
    label: "Consulting",
    labelColor: "text-teal-400",
    name: "Brianna T.",
    detail: "Business Consulting · 1hr · Mon, Apr 7",
    amount: "$150",
    time: "1 hr ago",
  },
] as const;

function formatPhone(digits: string): string {
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface ContactState {
  phone: string;
  email: string;
  notifySms: boolean;
  notifyEmail: boolean;
}

interface Props {
  contact?: ContactState;
}

export function PanelAdminContact({ contact }: Props) {
  const phone = contact?.phone ?? "";
  const email = contact?.email ?? "";
  const notifySms = contact?.notifySms ?? true;
  const notifyEmail = contact?.notifyEmail ?? true;

  const hasPhone = phone.length >= 10;
  const displayPhone = hasPhone ? formatPhone(phone) : null;

  const todayTotal = FEED.reduce((sum, e) => sum + parseInt(e.amount.replace("$", "")), 0);

  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] space-y-3"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-xs font-semibold text-accent uppercase tracking-[0.15em]">
              Live activity
            </p>
          </div>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            Four businesses. One place to know.
          </h2>
          <p className="text-sm text-muted leading-snug">
            Every booking and payment across lashes, jewelry, crochet, and consulting — straight to
            your phone.
          </p>
        </motion.div>

        {/* Activity feed */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-surface border border-foreground/8 overflow-hidden"
        >
          <div className="divide-y divide-foreground/5">
            {FEED.map(({ dot, label, labelColor, name, detail, amount, time }, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${labelColor}`}
                    >
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate">{name}</span>
                  </div>
                  <p className="text-[10px] text-muted/50 leading-tight mt-0.5 truncate">
                    {detail}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-emerald-500">{amount}</p>
                  <p className="text-[10px] text-muted/35">{time}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Daily total */}
          <div className="px-3 py-2 border-t border-foreground/6 bg-foreground/2 flex items-center gap-2">
            <LuTrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="text-[11px] text-muted/60">Today&apos;s revenue</span>
            <span className="ml-auto text-[11px] font-semibold text-emerald-500">
              ${todayTotal} via Square
            </span>
          </div>
        </motion.div>

        {/* Connector — booking → alert */}
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-0.5 py-0.5">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 border-t border-dashed border-foreground/10" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/8 border border-accent/15">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              <span className="text-[10px] font-semibold text-accent/80 uppercase tracking-wider">
                instant alert
              </span>
            </div>
            <div className="flex-1 border-t border-dashed border-foreground/10" />
          </div>
          <LuArrowDown className="w-3 h-3 text-accent/40" />
        </motion.div>

        {/* Live alert channels */}
        <motion.div variants={fadeUp} className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider">
            Where your alerts go
          </p>
          <div className="space-y-1.5">
            {(() => {
              const warn = notifySms && !hasPhone;
              return (
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 ${
                    warn
                      ? "bg-amber-400/6 border-amber-400/20"
                      : notifySms
                        ? "bg-rose-400/6 border-rose-400/20"
                        : "bg-surface border-foreground/6 opacity-50"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${warn ? "bg-amber-400/15" : notifySms ? "bg-rose-400/15" : "bg-foreground/6"}`}
                  >
                    <LuSmartphone
                      className={
                        warn ? "text-amber-400" : notifySms ? "text-rose-400" : "text-muted/40"
                      }
                      style={{ width: 12, height: 12 }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold leading-tight ${notifySms ? "text-foreground" : "text-muted/50"}`}
                    >
                      SMS — bookings & payments
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 truncate font-medium ${warn ? "text-amber-500/80" : notifySms ? "text-rose-400/80" : "text-muted/40"}`}
                    >
                      {warn
                        ? "⚠ needs a phone number"
                        : notifySms
                          ? displayPhone
                            ? `→ ${displayPhone}`
                            : "→ enter your phone number"
                          : "turned off"}
                    </p>
                  </div>
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${warn ? "bg-amber-400" : notifySms ? "bg-emerald-500" : "bg-foreground/15"}`}
                  />
                </div>
              );
            })()}

            <div
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200 ${
                notifyEmail
                  ? "bg-accent/6 border-accent/20"
                  : "bg-surface border-foreground/6 opacity-50"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${notifyEmail ? "bg-accent/12" : "bg-foreground/6"}`}
              >
                <LuMail
                  className={notifyEmail ? "text-accent" : "text-muted/40"}
                  style={{ width: 12, height: 12 }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-semibold leading-tight ${notifyEmail ? "text-foreground" : "text-muted/50"}`}
                >
                  Email — confirmations & summaries
                </p>
                <p
                  className={`text-[11px] mt-0.5 truncate ${notifyEmail ? "text-accent/70 font-medium" : "text-muted/40"}`}
                >
                  {notifyEmail ? (email ? `→ ${email}` : "→ your email address") : "turned off"}
                </p>
              </div>
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${notifyEmail ? "bg-emerald-500" : "bg-foreground/15"}`}
              />
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface border border-foreground/6">
              <div className="w-6 h-6 rounded-lg bg-foreground/6 flex items-center justify-center shrink-0">
                <LuBell className="text-muted/40" style={{ width: 12, height: 12 }} />
              </div>
              <p className="text-xs text-muted/50">In-app dashboard always shows the full feed</p>
            </div>
          </div>
        </motion.div>

        {/* Privacy note */}
        <motion.div variants={fadeUp} className="flex items-center gap-2">
          <LuShieldCheck className="w-3 h-3 text-muted/40 shrink-0" />
          <p className="text-xs text-muted/50">Only used to keep you in the loop — never shared.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
