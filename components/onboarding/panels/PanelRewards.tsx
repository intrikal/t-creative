"use client";

/**
 * PanelRewards.tsx — Loyalty program visualization panel for the rewards step.
 *
 * What: Displays three sections:
 *       1. A live "Points you're earning now" snapshot — three checklist items
 *          (profile complete, birthday added, referral added) that tick off in
 *          real time as the user fills in the left-side form, with a running
 *          total that animates when it changes.
 *       2. The four loyalty tiers (Member → Regular → VIP → Elite) as a
 *          horizontal progression of shaded tiles.
 *       3. A static list of earning events (first booking, birthday month,
 *          refer a friend, leave a review, complete profile) with point values.
 *
 * Why: Framing optional inputs (birthday, referrer) as point-earning actions
 *      dramatically increases fill rate. Seeing the running total update in real
 *      time makes the reward feel tangible before the client even books.
 *
 * How: `birthdayFilled` and `referralFilled` are derived from the props to
 *      compute `totalPoints` and drive the snapshot checklist. Props arrive from
 *      `form.Subscribe` in OnboardingFlow so only this panel re-renders when
 *      `birthday` or `referral` changes.
 *
 * Important: The point values displayed here (25/50/100 pts) must match the
 *      values hardcoded in `app/onboarding/actions.ts` — they are not read from
 *      admin config. If defaults change, update both files.
 *
 * @prop birthday - Raw birthday string from form (e.g. "04/15"); >= 5 chars = filled
 * @prop referral - Referral object; `referrerName` + `referrerEmail` both required
 *
 * Related files:
 * - components/onboarding/steps/StepRewards.tsx — the paired left-side form
 * - app/onboarding/actions.ts                   — awards the matching point values
 */
import { motion } from "framer-motion";
import { LuStar, LuGift, LuUsers, LuCalendarDays, LuSparkles, LuTrendingUp } from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

const TIERS = [
  { name: "Member", threshold: "0 pts", bg: "bg-foreground/6", text: "text-muted" },
  { name: "Regular", threshold: "500 pts", bg: "bg-accent/8", text: "text-accent/70" },
  { name: "VIP", threshold: "2,000 pts", bg: "bg-accent/15", text: "text-accent" },
  {
    name: "Elite",
    threshold: "5,000 pts",
    bg: "bg-accent/25",
    text: "text-accent font-semibold",
  },
];

const EARN_EVENTS = [
  { icon: LuCalendarDays, label: "First booking", pts: "+100 pts" },
  { icon: LuGift, label: "Birthday month", pts: "+50 pts" },
  { icon: LuUsers, label: "Refer a friend", pts: "+100 pts" },
  { icon: LuStar, label: "Leave a review", pts: "+75 pts" },
  { icon: LuSparkles, label: "Complete profile", pts: "+25 pts" },
];

interface Props {
  birthday?: string;
  referral?: {
    referrerName: string;
    referrerEmail: string;
    referrerPhone: string;
    skipped: boolean;
  };
}

export function PanelRewards({ birthday, referral }: Props) {
  const birthdayFilled = (birthday?.length ?? 0) >= 5;
  const referralFilled = !!(referral?.referrerName?.trim() && referral?.referrerEmail?.trim());
  const totalPoints = 25 + (birthdayFilled ? 50 : 0) + (referralFilled ? 100 : 0);

  const snapshot = [
    { label: "Complete profile", pts: 25, filled: true },
    { label: "Birthday added", pts: 50, filled: birthdayFilled },
    { label: "Referral added", pts: 100, filled: referralFilled },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-5"
      >
        {/* Live points snapshot */}
        <div>
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-3">
            Points you&apos;re earning now
          </p>
          <div className="rounded-xl border border-foreground/5 bg-surface p-4 space-y-2.5">
            {snapshot.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-colors duration-200 ${
                      item.filled ? "border-accent bg-accent" : "border-foreground/15"
                    }`}
                  >
                    {item.filled && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M2 5L4 7L8 3"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`text-xs transition-colors duration-200 ${item.filled ? "text-foreground" : "text-muted/40"}`}
                  >
                    {item.label}
                  </span>
                </div>
                <motion.span
                  key={`${item.label}-${item.filled}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-[11px] font-medium tabular-nums transition-colors duration-200 ${item.filled ? "text-accent" : "text-muted/25"}`}
                >
                  +{item.pts} pts
                </motion.span>
              </div>
            ))}
            <div className="pt-2.5 border-t border-foreground/5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Earned so far</span>
              <motion.span
                key={totalPoints}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-semibold text-accent tabular-nums"
              >
                {totalPoints} pts
              </motion.span>
            </div>
          </div>
          <p className="text-[10px] text-muted/50 mt-1.5 ml-0.5">
            +100 pts awarded automatically on your first booking
          </p>
        </div>

        {/* Tier progression */}
        <div>
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-3">
            Loyalty tiers
          </p>
          <div className="flex gap-1.5">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
                className={`flex-1 rounded-lg px-1.5 py-2.5 text-center ${tier.bg}`}
              >
                <p className={`text-[10px] font-medium ${tier.text}`}>{tier.name}</p>
                <p className="text-[9px] text-muted/50 mt-0.5">{tier.threshold}</p>
              </motion.div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <LuTrendingUp className="w-3 h-3 text-accent/60 shrink-0" />
            <p className="text-[10px] text-muted/50">
              Higher tiers earn up to 2× points per dollar
            </p>
          </div>
        </div>

        {/* Earning events */}
        <div>
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-3">
            Ways to earn
          </p>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
            {EARN_EVENTS.map((ev) => (
              <motion.div
                key={ev.label}
                variants={fadeUp}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-accent/8 flex items-center justify-center shrink-0">
                    <ev.icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <span className="text-xs text-foreground">{ev.label}</span>
                </div>
                <span className="text-[11px] font-medium text-accent tabular-nums">{ev.pts}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-[10px] text-muted/50 text-center"
        >
          10 pts earned per $1 spent &middot; 100 pts = $1 off your next service
        </motion.p>
      </motion.div>
    </div>
  );
}
