"use client";

/**
 * PanelAdminPolicies — the right-panel for step 8 (admin policies step).
 *
 * ## Purpose
 * Shows the admin a live summary of their booking protection settings —
 * booking confirmation type, waitlist status per service, and protection fees.
 *
 * ## Sections
 * 1. **Booking confirmation** — "Instant confirm" or "Review first" based on
 *    the `bookingConfirmation` prop.
 * 2. **Waitlist rows** — one row per service (lash, jewelry, crochet, consulting).
 *    Lash/jewelry/crochet show a simple On/Off badge. Consulting shows a 3-state
 *    badge: "Off", "Request-based", or "Auto-waitlist".
 * 3. **Protection fees** — two rows (cancellation + no-show). Each shows the
 *    fee amount and relevant parameters if set, or dims to 40% opacity when no fee
 *    is configured.
 *
 * ## Consulting 3-state
 * Consulting is different from the other services because it doesn't have a
 * simple "waitlist on/off" — it supports a "request-based" mode where clients
 * submit a request form that the admin reviews before accepting. `CONSULTING_COPY`
 * maps each state to the appropriate short label and detail text.
 *
 * ## Props
 * @prop waitlist - { lash: bool, jewelry: bool, crochet: bool, consulting: "off"|"request"|"waitlist" }
 * @prop bookingConfirmation - "instant" | "manual"
 * @prop cancellationFee - fee amount as a string (e.g. "25"), empty if not set
 * @prop cancellationWindow - hours within which the fee applies (e.g. "24")
 * @prop noShowFee - fee amount as a string (e.g. "50"), empty if not set
 */
import { motion } from "framer-motion";
import {
  LuEye,
  LuGem,
  LuScissors,
  LuLightbulb,
  LuShieldAlert,
  LuClock,
  LuBanknote,
  LuZap,
  LuListChecks,
} from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

interface Props {
  waitlist: {
    lash: boolean;
    jewelry: boolean;
    crochet: boolean;
    consulting: "off" | "request" | "waitlist";
  };
  bookingConfirmation: "instant" | "manual";
  cancellationFee: string;
  cancellationWindow: string;
  noShowFee: string;
}

const WAITLIST_META = [
  {
    key: "lash" as const,
    label: "Lash Extensions",
    icon: LuEye,
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    whenOn:
      "Client tries to book a full lash slot → they join your list. The moment you open a slot, they get a text to claim it.",
  },
  {
    key: "jewelry" as const,
    label: "Permanent Jewelry",
    icon: LuGem,
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    whenOn:
      "Pop-up slots sell out fast. A waitlist means no one misses out — and you fill every cancellation automatically.",
  },
  {
    key: "crochet" as const,
    label: "Crochet",
    icon: LuScissors,
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    whenOn:
      "Installs are 3h+ and limited to a few per week. The waitlist lines up your next clients without a single DM.",
  },
] as const;

const CONSULTING_COPY: Record<"off" | "request" | "waitlist", { short: string; detail: string }> = {
  off: {
    short: "Off",
    detail: "Consulting is booked through your direct link only. You control who gets in.",
  },
  request: {
    short: "Request-based",
    detail:
      "Clients describe what they need and submit a request. You review it and decide — no surprise projects, no wrong-fit clients.",
  },
  waitlist: {
    short: "Auto-waitlist",
    detail:
      "Next available consulting slot goes to whoever submitted first, same as a service booking.",
  },
};

export function PanelAdminPolicies({
  waitlist,
  bookingConfirmation,
  cancellationFee,
  cancellationWindow,
  noShowFee,
}: Props) {
  const consultingCopy = CONSULTING_COPY[waitlist.consulting];
  const hasCancelFee = !!cancellationFee;
  const hasNoShowFee = !!noShowFee;

  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] space-y-2"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            How this protects you
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            Set it once. It runs itself.
          </h2>
          <p className="text-xs text-muted/60 mt-0.5 leading-snug">
            No chasing, no awkward texts, no lost income from last-minute cancels.
          </p>
        </motion.div>

        {/* Booking confirmation */}
        <motion.div variants={fadeUp}>
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1">
            Booking confirmation
          </p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-surface border-foreground/8">
            {bookingConfirmation === "instant" ? (
              <LuZap className="w-3.5 h-3.5 text-accent shrink-0" />
            ) : (
              <LuListChecks className="w-3.5 h-3.5 text-accent shrink-0" />
            )}
            <p className="text-xs font-semibold text-foreground">
              {bookingConfirmation === "instant" ? "Instant confirm" : "Review first"}
            </p>
            <p className="text-[11px] text-muted/50 leading-snug">
              {bookingConfirmation === "instant"
                ? "— auto-confirmed, no back-and-forth"
                : "— you approve each request"}
            </p>
          </div>
        </motion.div>

        {/* Waitlist — compact rows */}
        <motion.div variants={fadeUp} className="space-y-1">
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider">
            Waitlist
          </p>
          {WAITLIST_META.map(({ key, label, icon: Icon, color, bg }) => {
            const on = waitlist[key];
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-surface border-foreground/8"
              >
                <div
                  className={`w-5 h-5 rounded-md ${bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={color} style={{ width: 10, height: 10 }} />
                </div>
                <p
                  className={`text-xs font-semibold flex-1 ${on ? "text-foreground" : "text-foreground/35"}`}
                >
                  {label}
                </p>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0
                  ${on ? "text-emerald-500 bg-emerald-500/10" : "text-muted/40 bg-foreground/6"}`}
                >
                  {on ? "On" : "Off"}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-surface border-foreground/8">
            <div className="w-5 h-5 rounded-md bg-teal-400/12 flex items-center justify-center shrink-0">
              <LuLightbulb className="text-teal-400" style={{ width: 10, height: 10 }} />
            </div>
            <p
              className={`text-xs font-semibold flex-1 ${waitlist.consulting !== "off" ? "text-foreground" : "text-foreground/35"}`}
            >
              Consulting
            </p>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0
              ${
                waitlist.consulting === "off"
                  ? "text-muted/40 bg-foreground/6"
                  : waitlist.consulting === "request"
                    ? "text-teal-500 bg-teal-500/10"
                    : "text-emerald-500 bg-emerald-500/10"
              }`}
            >
              {consultingCopy.short}
            </span>
          </div>
        </motion.div>

        {/* Fee rows — compact */}
        <motion.div variants={fadeUp} className="space-y-1">
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider">
            Protection fees
          </p>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200
            ${hasCancelFee ? "bg-surface border-foreground/8" : "bg-foreground/2 border-foreground/5 opacity-40"}`}
          >
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${hasCancelFee ? "bg-amber-400/12" : "bg-foreground/5"}`}
            >
              <LuClock
                className={hasCancelFee ? "text-amber-400" : "text-muted/30"}
                style={{ width: 10, height: 10 }}
              />
            </div>
            <p className="text-xs font-semibold text-foreground flex-1">Cancellation</p>
            <p className="text-[11px] text-muted/55">
              {hasCancelFee
                ? `$${cancellationFee} inside ${cancellationWindow || "24"}h`
                : "No fee"}
            </p>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200
            ${hasNoShowFee ? "bg-surface border-foreground/8" : "bg-foreground/2 border-foreground/5 opacity-40"}`}
          >
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${hasNoShowFee ? "bg-rose-400/12" : "bg-foreground/5"}`}
            >
              <LuShieldAlert
                className={hasNoShowFee ? "text-rose-400" : "text-muted/30"}
                style={{ width: 10, height: 10 }}
              />
            </div>
            <p className="text-xs font-semibold text-foreground flex-1">No-show</p>
            <p className="text-[11px] text-muted/55">
              {hasNoShowFee ? `$${noShowFee} charged via Square` : "No fee"}
            </p>
          </div>
        </motion.div>

        {/* Footer note */}
        <motion.div variants={fadeUp} className="flex items-center gap-1.5 px-1">
          <LuBanknote className="w-3 h-3 text-muted/30 shrink-0" />
          <p className="text-[11px] text-muted/40">
            All fees collected by Square, transferred to your account.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
