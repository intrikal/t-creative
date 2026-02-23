"use client";

/**
 * PanelAdminRewards — the right-panel for step 9 (admin rewards step).
 *
 * ## Purpose
 * Gives the admin an interactive preview of their loyalty program from the
 * client's perspective. They can click through tier tabs to see how the mock
 * loyalty card and earn calculation change per tier.
 *
 * ## Sections
 * 1. **Tier tabs** — 4 clickable tiles (Member / Regular / VIP / Elite by default).
 *    Selected tier is highlighted; clicking updates `selectedTierIdx` state.
 * 2. **Mock loyalty card** — a gradient card showing mock point balance, tier badge,
 *    and multiplier for the selected tier. Uses `TIER_MOCK_PTS` to show a realistic
 *    point value per tier.
 * 3. **Earn example** — calculates how many points a client earns on a $120 lash
 *    set at the selected tier: `pointsPerDollar × multiplier × 120`.
 * 4. **Bonus events grid** — a 3-column compact grid of all 15 bonus event types,
 *    showing their icon, label, and point value. When rewards are disabled, all
 *    bonuses are shown as a preview (with `fallback` values); when enabled, only
 *    configured bonuses (non-empty value in the `rewards` prop) are shown.
 * 5. **Expiry note** — "Points never expire" or "Points expire after N months".
 *
 * ## Disabled overlay
 * When `rewards.enabled` is false, the entire preview section fades to 35%
 * opacity and an overlay pill ("Enable above to activate") appears in the center.
 *
 * ## State
 * - `selectedTierIdx` — which tier tab is active (defaults to 1 = Regular)
 *
 * ## Props
 * @prop rewards - the full rewards sub-object from the form, or null if the
 *   rewards field hasn't initialized yet (panel returns null in that case)
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  LuGift,
  LuStar,
  LuCalendarCheck,
  LuCake,
  LuUsers,
  LuRepeat,
  LuMessageSquare,
  LuArrowRight,
  LuClock,
  LuShare2,
  LuShoppingBag,
  LuUserCheck,
  LuPartyPopper,
  LuTrophy,
  LuZap,
  LuGraduationCap,
  LuPackage,
  LuBookOpen,
  LuBadgeCheck,
} from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

interface Props {
  rewards: {
    enabled: boolean;
    pointsPerDollar: string;
    pointsToRedeem: string;
    firstBookingBonus: string;
    birthdayBonus: string;
    referralBonus: string;
    refereeBonus: string;
    reviewBonus: string;
    rebookBonus: string;
    milestoneBonus: string;
    socialShareBonus: string;
    productPurchaseBonus: string;
    profileCompleteBonus: string;
    anniversaryBonus: string;
    newServiceBonus: string;
    classAttendanceBonus: string;
    packagePurchaseBonus: string;
    programCompleteBonus: string;
    certificationBonus: string;
    milestone10thBonus: string;
    tier1Name: string;
    tier1Threshold: string;
    tier1Multiplier: string;
    tier2Name: string;
    tier2Threshold: string;
    tier2Multiplier: string;
    tier3Name: string;
    tier3Threshold: string;
    tier3Multiplier: string;
    tier4Name: string;
    tier4Threshold: string;
    tier4Multiplier: string;
    pointsExpiry: string;
  } | null;
}

const BONUS_META = [
  // Visits
  {
    key: "firstBookingBonus" as const,
    icon: LuCalendarCheck,
    label: "First booking",
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    fallback: "100",
  },
  {
    key: "rebookBonus" as const,
    icon: LuRepeat,
    label: "Rebook same day",
    color: "text-teal-400",
    bg: "bg-teal-400/12",
    fallback: "50",
  },
  {
    key: "milestoneBonus" as const,
    icon: LuMessageSquare,
    label: "5th visit",
    color: "text-emerald-400",
    bg: "bg-emerald-400/12",
    fallback: "200",
  },
  {
    key: "milestone10thBonus" as const,
    icon: LuTrophy,
    label: "10th visit",
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    fallback: "400",
  },
  {
    key: "newServiceBonus" as const,
    icon: LuZap,
    label: "New service",
    color: "text-teal-400",
    bg: "bg-teal-400/12",
    fallback: "75",
  },
  // Community
  {
    key: "referralBonus" as const,
    icon: LuUsers,
    label: "You refer",
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    fallback: "100",
  },
  {
    key: "refereeBonus" as const,
    icon: LuUsers,
    label: "They join",
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    fallback: "50",
  },
  {
    key: "reviewBonus" as const,
    icon: LuStar,
    label: "Leave a review",
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    fallback: "75",
  },
  {
    key: "socialShareBonus" as const,
    icon: LuShare2,
    label: "Tag us on social",
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    fallback: "50",
  },
  // Account
  {
    key: "profileCompleteBonus" as const,
    icon: LuUserCheck,
    label: "Complete profile",
    color: "text-emerald-400",
    bg: "bg-emerald-400/12",
    fallback: "25",
  },
  {
    key: "birthdayBonus" as const,
    icon: LuCake,
    label: "Birthday",
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    fallback: "50",
  },
  {
    key: "anniversaryBonus" as const,
    icon: LuPartyPopper,
    label: "Anniversary",
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    fallback: "100",
  },
  // Purchases & Training
  {
    key: "productPurchaseBonus" as const,
    icon: LuShoppingBag,
    label: "Buy a product",
    color: "text-teal-400",
    bg: "bg-teal-400/12",
    fallback: "25",
  },
  {
    key: "packagePurchaseBonus" as const,
    icon: LuPackage,
    label: "Buy a package",
    color: "text-sky-400",
    bg: "bg-sky-400/12",
    fallback: "200",
  },
  {
    key: "classAttendanceBonus" as const,
    icon: LuGraduationCap,
    label: "Attend a class",
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    fallback: "150",
  },
  {
    key: "programCompleteBonus" as const,
    icon: LuBookOpen,
    label: "Complete program",
    color: "text-indigo-400",
    bg: "bg-indigo-400/12",
    fallback: "300",
  },
  {
    key: "certificationBonus" as const,
    icon: LuBadgeCheck,
    label: "Get certified",
    color: "text-amber-500",
    bg: "bg-amber-500/12",
    fallback: "500",
  },
];

const TIER_COLORS = [
  { color: "text-amber-700", bg: "bg-amber-700/15", border: "border-amber-700/30" },
  { color: "text-zinc-500", bg: "bg-zinc-400/15", border: "border-zinc-400/35" },
  { color: "text-amber-500", bg: "bg-amber-400/15", border: "border-amber-400/35" },
  { color: "text-violet-500", bg: "bg-violet-400/15", border: "border-violet-400/35" },
];

export function PanelAdminRewards({ rewards }: Props) {
  const [selectedTierIdx, setSelectedTierIdx] = useState<number | null>(null);

  if (!rewards) return null;

  const enabled = rewards.enabled;
  const ppts = parseInt(rewards.pointsPerDollar) || 10;
  const prdr = parseInt(rewards.pointsToRedeem) || 100;

  const tiers = [
    {
      name: rewards.tier1Name || "Member",
      threshold: 0,
      multiplier: parseFloat(rewards.tier1Multiplier) || 1,
    },
    {
      name: rewards.tier2Name || "Regular",
      threshold: parseInt(rewards.tier2Threshold) || 500,
      multiplier: parseFloat(rewards.tier2Multiplier) || 1.25,
    },
    {
      name: rewards.tier3Name || "VIP",
      threshold: parseInt(rewards.tier3Threshold) || 2000,
      multiplier: parseFloat(rewards.tier3Multiplier) || 1.5,
    },
    {
      name: rewards.tier4Name || "Elite",
      threshold: parseInt(rewards.tier4Threshold) || 5000,
      multiplier: parseFloat(rewards.tier4Multiplier) || 2,
    },
  ];

  // Mock pts per tier — show threshold or a small default for tier 0
  const TIER_MOCK_PTS = [
    250,
    tiers[1].threshold || 500,
    tiers[2].threshold || 2000,
    tiers[3].threshold || 5000,
  ];

  const activeTierIdx = selectedTierIdx ?? 1; // default preview on "Regular"
  const mockPts = TIER_MOCK_PTS[activeTierIdx];
  const effectivePpts = ppts * tiers[activeTierIdx].multiplier;
  const exampleEarned = Math.round(effectivePpts * 120);
  const exampleWorth = (exampleEarned / prdr).toFixed(2);

  const activeBonuses = enabled ? BONUS_META.filter((b) => !!rewards[b.key]) : BONUS_META;

  const getBonusPts = (key: (typeof BONUS_META)[number]["key"], fallback: string) =>
    rewards[key] || fallback;

  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] space-y-2.5"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <p className="text-xs font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            {enabled ? "Your program" : "Preview"}
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            {enabled ? "Here's what clients experience." : "Here's what you'd activate."}
          </h2>
        </motion.div>

        {/* Preview wrapper */}
        <motion.div variants={fadeUp} className="relative">
          <motion.div
            animate={{ opacity: enabled ? 1 : 0.35 }}
            transition={{ duration: 0.3 }}
            className="space-y-2"
          >
            {/* Tier tabs */}
            <div>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1">
                Tiers — click to preview
              </p>
              <div className="grid grid-cols-4 gap-1">
                {tiers.map((tier, i) => {
                  const isActive = i === activeTierIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedTierIdx(i)}
                      className={`px-1.5 py-1.5 rounded-xl border text-center transition-all duration-150 cursor-pointer ${TIER_COLORS[i].bg} ${TIER_COLORS[i].border} ${isActive ? `ring-1 ring-offset-1 ring-offset-background ${TIER_COLORS[i].border} brightness-110` : "opacity-50 hover:opacity-75"}`}
                    >
                      <p className={`text-xs font-bold truncate ${TIER_COLORS[i].color}`}>
                        {tier.name}
                      </p>
                      <p className="text-[9px] text-muted/50 leading-tight">
                        {tier.threshold === 0
                          ? "Start"
                          : `${tier.threshold >= 1000 ? `${tier.threshold / 1000}k` : tier.threshold}+`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mock loyalty card */}
            <motion.div
              key={activeTierIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 rounded-2xl bg-gradient-to-br from-accent/15 via-accent/8 to-transparent border border-accent/20"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">
                    T Creative Rewards
                  </p>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {mockPts.toLocaleString()}{" "}
                    <span className="text-xs font-medium text-muted/60">pts</span>
                  </p>
                  <p className="text-[10px] text-muted/60">
                    = ${(mockPts / prdr).toFixed(2)} in rewards
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${TIER_COLORS[activeTierIdx].bg} border ${TIER_COLORS[activeTierIdx].border}`}
                  >
                    <LuStar
                      className={TIER_COLORS[activeTierIdx].color}
                      style={{ width: 10, height: 10 }}
                    />
                    <span className={`text-sm font-extrabold ${TIER_COLORS[activeTierIdx].color}`}>
                      {tiers[activeTierIdx].name}
                    </span>
                  </div>
                  {tiers[activeTierIdx].multiplier > 1 && (
                    <p className="text-[10px] text-accent mt-1 font-bold">
                      {tiers[activeTierIdx].multiplier}× pts/visit
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Earn example */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-foreground/8">
              <div className="flex-1">
                <p className="text-[10px] text-muted/50">
                  $120 lash set at{" "}
                  <span className="font-semibold">{tiers[activeTierIdx].name}</span>
                </p>
              </div>
              <LuArrowRight className="text-muted/30 shrink-0" style={{ width: 10, height: 10 }} />
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">
                  +{exampleEarned.toLocaleString()} pts
                </p>
                <p className="text-[10px] text-accent">worth ${exampleWorth}</p>
              </div>
            </div>

            {/* Active bonuses — 3-col compact */}
            <div>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-1">
                Bonus events{!enabled ? "" : ` — ${activeBonuses.length} active`}
              </p>
              <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                {activeBonuses.map(({ key, icon: Icon, label, color, bg, fallback }) => (
                  <div key={key} className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-md ${bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={color} style={{ width: 9, height: 9 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-foreground/65 truncate leading-tight">
                        {label}
                      </p>
                      <p className="text-[10px] font-semibold text-accent">
                        +{getBonusPts(key, fallback)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expiry note */}
            <div className="flex items-center gap-1.5 px-1">
              <LuClock className="w-3 h-3 text-muted/35 shrink-0" />
              <p className="text-[10px] text-muted/45">
                {enabled
                  ? rewards.pointsExpiry
                    ? `Points expire after ${rewards.pointsExpiry} months of inactivity`
                    : "Points never expire"
                  : "Points never expire by default"}
              </p>
            </div>
          </motion.div>

          {/* Disabled overlay */}
          {!enabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/90 border border-foreground/12 shadow-sm backdrop-blur-sm">
                <LuGift className="w-3.5 h-3.5 text-muted/50 shrink-0" />
                <span className="text-xs font-semibold text-foreground/50">
                  Enable above to activate
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div variants={fadeUp} className="flex items-start gap-2 px-1">
          <LuGift className="w-3 h-3 text-muted/30 shrink-0 mt-0.5" />
          <p className="text-xs text-muted/40 leading-relaxed">
            {enabled
              ? "Points are tracked automatically. Clients see their balance after every booking."
              : "You can enable or adjust this any time from your dashboard."}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
