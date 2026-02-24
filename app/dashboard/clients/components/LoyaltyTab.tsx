"use client";

import { useState } from "react";
import {
  Gift,
  Award,
  Sparkles,
  Cake,
  CalendarDays,
  Tag,
  Zap,
  Crown,
  Scissors,
  BadgeCheck,
  Ticket,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { issueLoyaltyReward } from "../actions";
import { type LoyaltyEntry, TIER_CONFIG, getTier, avatarColor, initials } from "../ClientsPage";

/* ------------------------------------------------------------------ */
/*  Tier perks config                                                   */
/* ------------------------------------------------------------------ */

const TIER_PERKS: Record<string, { perk: string; Icon: LucideIcon }[]> = {
  bronze: [
    { perk: "5% off on your birthday", Icon: Cake },
    { perk: "Early booking access", Icon: CalendarDays },
  ],
  silver: [
    { perk: "10% off 1 service per month", Icon: Tag },
    { perk: "Free lash bath add-on", Icon: Sparkles },
    { perk: "All Bronze perks", Icon: ChevronRight },
  ],
  gold: [
    { perk: "15% off all services", Icon: Tag },
    { perk: "Free add-on every visit", Icon: Gift },
    { perk: "Priority booking", Icon: Zap },
    { perk: "All Silver perks", Icon: ChevronRight },
  ],
  platinum: [
    { perk: "20% off all services", Icon: Crown },
    { perk: "1 complimentary service/mo", Icon: Scissors },
    { perk: "VIP event invites", Icon: Ticket },
    { perk: "All Gold perks", Icon: ChevronRight },
  ],
};

/* ------------------------------------------------------------------ */
/*  Reward options                                                      */
/* ------------------------------------------------------------------ */

type RewardType = "discount" | "addon" | "service" | "points";

const REWARD_OPTIONS: { id: RewardType; label: string; desc: string; Icon: LucideIcon }[] = [
  { id: "discount", label: "Discount", desc: "$ or % off their next visit", Icon: Tag },
  { id: "addon", label: "Free Add-on", desc: "Complimentary upgrade or add-on", Icon: Sparkles },
  { id: "service", label: "Free Service", desc: "One service on the house", Icon: Scissors },
  { id: "points", label: "Bonus Points", desc: "Manually add points to balance", Icon: Zap },
];

/* ------------------------------------------------------------------ */
/*  IssueRewardDialog                                                   */
/* ------------------------------------------------------------------ */

function IssueRewardDialog({
  entry,
  onClose,
  onIssue,
}: {
  entry: LoyaltyEntry;
  onClose: () => void;
  onIssue: (
    type: RewardType,
    amount: string,
    note: string,
  ) => { tieredUp: boolean; newTier: LoyaltyEntry["tier"] } | void;
}) {
  const [type, setType] = useState<RewardType>("discount");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<{ tieredUp: boolean; newTier: LoyaltyEntry["tier"] } | null>(
    null,
  );

  const handleConfirm = () => {
    const result = onIssue(type, amount, note);
    setIssued(result ?? { tieredUp: false, newTier: getTier(entry.points) });
  };

  if (issued) {
    const cfg = TIER_CONFIG[issued.newTier];
    return (
      <Dialog open onClose={onClose} title="Reward Issued" size="sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              issued.tieredUp ? cfg.bg : "bg-[#4e6b51]/15",
            )}
          >
            {issued.tieredUp ? (
              <Award className={cn("w-6 h-6", cfg.color)} />
            ) : (
              <BadgeCheck className="w-6 h-6 text-[#4e6b51]" />
            )}
          </div>
          {issued.tieredUp ? (
            <>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold",
                  cfg.color,
                  cfg.bg,
                  cfg.border,
                )}
              >
                <Award className={cn("w-3.5 h-3.5", cfg.color)} />
                {cfg.label} Tier Unlocked!
              </div>
              <p className="text-sm font-semibold text-foreground">{entry.name} leveled up!</p>
              <p className="text-xs text-muted leading-relaxed">
                They&apos;ve crossed into{" "}
                <span className={cn("font-semibold", cfg.color)}>{cfg.label}</span> and now have
                access to their new tier perks.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Reward sent to {entry.name}!</p>
              <p className="text-xs text-muted">
                They&apos;ll receive a notification with their reward details.
              </p>
            </>
          )}
        </div>
        <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Done" />
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={`Issue Reward — ${entry.name}`} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border">
          <Award className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-xs text-muted">Current balance: </span>
          <span className="text-xs font-semibold text-foreground">
            {entry.points.toLocaleString()} pts
          </span>
          {entry.points >= 500 && (
            <span className="ml-auto text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-2 py-0.5 rounded-full border border-[#4e6b51]/20">
              Can redeem
            </span>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted mb-2">Reward type</p>
          <div className="grid grid-cols-2 gap-2">
            {REWARD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setType(opt.id)}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                  type === opt.id
                    ? "border-accent bg-accent/8"
                    : "border-border hover:border-foreground/20 hover:bg-foreground/4",
                )}
              >
                <opt.Icon
                  className={cn(
                    "w-3.5 h-3.5 mt-0.5 shrink-0",
                    type === opt.id ? "text-accent" : "text-muted",
                  )}
                />
                <div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      type === opt.id ? "text-accent" : "text-foreground",
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-muted leading-tight mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {(type === "discount" || type === "points") && (
          <Field label={type === "discount" ? "Amount (e.g. $10 or 15%)" : "Points to add"}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === "discount" ? "$10 or 15%" : "e.g. 100"}
              autoFocus
            />
          </Field>
        )}

        <Field label="Note to client" hint="Optional — shown in their reward notification">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Thank you for being a loyal client!"
            rows={2}
          />
        </Field>
      </div>
      <DialogFooter onCancel={onClose} onConfirm={handleConfirm} confirmLabel="Issue Reward" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  LoyaltyTab                                                          */
/* ------------------------------------------------------------------ */

export function LoyaltyTab({ initialLoyalty }: { initialLoyalty: LoyaltyEntry[] }) {
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyEntry[]>(initialLoyalty);
  const [showPerks, setShowPerks] = useState(false);
  const [issueTarget, setIssueTarget] = useState<LoyaltyEntry | null>(null);

  const handleIssue = (entry: LoyaltyEntry, type: RewardType, amount: string, note: string) => {
    if (type !== "points") return;
    const pts = parseInt(amount, 10);
    if (!pts || isNaN(pts) || pts <= 0) return;

    const newPoints = entry.points + pts;
    const newTier = getTier(newPoints);
    const tieredUp = newTier !== entry.tier;
    const nextPoints = TIER_CONFIG[newTier].nextPoints;

    // Persist to DB
    issueLoyaltyReward(entry.id, pts, note || `Manual credit: +${pts} points`);

    setLoyaltyData((prev) =>
      prev
        .map((l) =>
          l.id === entry.id
            ? {
                ...l,
                points: newPoints,
                tier: newTier,
                pointsToNext: nextPoints ? Math.max(0, nextPoints - newPoints) : 0,
              }
            : l,
        )
        .sort((a, b) => b.points - a.points),
    );

    setIssueTarget((prev) =>
      prev && prev.id === entry.id ? { ...prev, points: newPoints, tier: newTier } : prev,
    );

    return { tieredUp, newTier };
  };

  const totals = {
    enrolled: loyaltyData.length,
    redeemable: loyaltyData.filter((l) => l.points >= 500).length,
    totalPoints: loyaltyData.reduce((s, l) => s + l.points, 0),
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Loyalty Program</h2>
          <p className="text-xs text-muted mt-0.5">
            $1 spent = 1 point · 500 pts = $5 off · Tiers unlock perks automatically
          </p>
        </div>
        <button
          onClick={() => setShowPerks((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {showPerks ? "Hide Perks" : "View Rewards"}
        </button>
      </div>

      {/* Perks panel */}
      {showPerks && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
            const cfg = TIER_CONFIG[tier];
            const perks = TIER_PERKS[tier];
            return (
              <div key={tier} className={cn("rounded-xl border p-3 space-y-2", cfg.bg, cfg.border)}>
                <div className="flex items-center gap-1.5">
                  <Award className={cn("w-3.5 h-3.5", cfg.color)} />
                  <p className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</p>
                  <span className="text-[10px] text-muted ml-auto">
                    {cfg.nextPoints ? `${cfg.minPoints}–${cfg.nextPoints}` : `${cfg.minPoints}+`}{" "}
                    pts
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {perks.map((p) => (
                    <li
                      key={p.perk}
                      className="flex items-center gap-1.5 text-[11px] text-foreground/80"
                    >
                      <p.Icon className={cn("w-3 h-3 shrink-0", cfg.color)} />
                      <span>{p.perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Tier summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
          const cfg = TIER_CONFIG[tier];
          const count = loyaltyData.filter((l) => l.tier === tier).length;
          return (
            <div key={tier} className={cn("rounded-xl border p-3", cfg.bg, cfg.border)}>
              <div className="flex items-center gap-1.5 mb-2">
                <Award className={cn("w-3.5 h-3.5", cfg.color)} />
                <p className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">{count}</p>
              <p className="text-[10px] text-muted mt-0.5">
                {cfg.nextPoints
                  ? `${cfg.minPoints}–${cfg.nextPoints} pts`
                  : `${cfg.minPoints}+ pts`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">All Members</p>
          <span className="text-[10px] text-muted">
            {totals.enrolled} enrolled · {totals.redeemable} can redeem now ·{" "}
            {totals.totalPoints.toLocaleString()} pts total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Client
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Tier
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                  Progress
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5 hidden md:table-cell">
                  Total Spent
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 hidden md:table-cell">
                  Last Activity
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                  Issue
                </th>
              </tr>
            </thead>
            <tbody>
              {loyaltyData.map((l) => {
                const cfg = TIER_CONFIG[l.tier];
                const av = avatarColor(l.name);
                const canRedeem = l.points >= 500;
                const tierMin = cfg.minPoints;
                const tierMax = cfg.nextPoints ?? cfg.minPoints + 1500;
                const pct = Math.min(
                  100,
                  Math.round(((l.points - tierMin) / (tierMax - tierMin)) * 100),
                );
                return (
                  <tr
                    key={l.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                            av,
                          )}
                        >
                          {initials(l.name)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{l.name}</span>
                          {canRedeem && (
                            <span className="ml-2 text-[9px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-1.5 py-0.5 rounded-full border border-[#4e6b51]/20">
                              Redeemable
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          cfg.color,
                          cfg.bg,
                          cfg.border,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              l.tier === "platinum"
                                ? "bg-[#5b8a8a]"
                                : l.tier === "gold"
                                  ? "bg-[#d4a574]"
                                  : l.tier === "silver"
                                    ? "bg-foreground/30"
                                    : "bg-[#a07040]",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">
                          {l.tier === "platinum"
                            ? `${l.points.toLocaleString()} pts`
                            : `${l.points}/${cfg.nextPoints}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden md:table-cell">
                      <span className="text-sm text-foreground tabular-nums">
                        ${l.totalSpent.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle hidden md:table-cell">
                      <span className="text-xs text-muted">{l.lastActivity}</span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <button
                        onClick={() => setIssueTarget(l)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/15 transition-colors mx-auto"
                      >
                        <Gift className="w-3 h-3" />
                        Issue
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue reward dialog */}
      {issueTarget && (
        <IssueRewardDialog
          entry={issueTarget}
          onClose={() => setIssueTarget(null)}
          onIssue={(type, amount, note) => handleIssue(issueTarget, type, amount, note)}
        />
      )}
    </div>
  );
}
