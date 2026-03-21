"use client";

/**
 * LoyaltyPage.tsx — Client loyalty & referrals page.
 *
 * A warm, inviting page with a wide-screen two-column layout matching
 * the dashboard home page pattern. Shows tier status, perks, referral code,
 * how to earn, redemption info, and points history.
 */

import { useState, useRef, useEffect, useTransition } from "react";
import { useTimeoutFlag } from "@/lib/hooks/use-timeout-flag";
import type { LoyaltyPageData, ClientReward } from "./actions";
import { redeemPoints, cancelRedemption } from "./actions";
import { EarnCard } from "./components/EarnCard";
import { getTier, TIER_PERKS } from "./components/helpers";
import { MembershipCard } from "./components/MembershipCard";
import { PendingRedemptions } from "./components/PendingRedemptions";
import { PerksCard } from "./components/PerksCard";
import { PointsHistory } from "./components/PointsHistory";
import { RedeemPointsCard } from "./components/RedeemPointsCard";
import { ReferralCard } from "./components/ReferralCard";
import { TierHeroCard } from "./components/TierHeroCard";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LoyaltyPage({ data }: { data: LoyaltyPageData }) {
  const [copied, triggerCopied] = useTimeoutFlag(2500);
  const [redeemedLabel, setRedeemedLabel] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const redeemedTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [isRedeeming, startRedeemTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (redeemedTimer.current) clearTimeout(redeemedTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);
  const tier = getTier(data.totalPoints);
  const isMaxTier = tier.name === "Platinum";
  const progress = isMaxTier
    ? 100
    : Math.min(100, Math.round((data.totalPoints / tier.nextAt) * 100));
  const pointsToNext = isMaxTier ? 0 : tier.nextAt - data.totalPoints;

  function copyCode() {
    if (!data.referralCode) return;
    const url = `https://tcreativestudio.com/book/tcreativestudio?ref=${data.referralCode}`;
    navigator.clipboard.writeText(url);
    triggerCopied();
  }

  function handleRedeem(reward: ClientReward) {
    setRedeemError(null);
    startRedeemTransition(async () => {
      try {
        await redeemPoints({ rewardId: reward.id });
        setRedeemedLabel(reward.label);
        if (redeemedTimer.current) clearTimeout(redeemedTimer.current);
        redeemedTimer.current = setTimeout(() => setRedeemedLabel(null), 4000);
      } catch (err) {
        setRedeemError(err instanceof Error ? err.message : "Something went wrong.");
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setRedeemError(null), 4000);
      }
    });
  }

  function handleCancelRedemption(redemptionId: string) {
    setRedeemError(null);
    startRedeemTransition(async () => {
      try {
        await cancelRedemption(redemptionId);
      } catch (err) {
        setRedeemError(err instanceof Error ? err.message : "Something went wrong.");
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setRedeemError(null), 4000);
      }
    });
  }

  const currentPerks = TIER_PERKS[tier.name] ?? [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Personalized Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          {data.firstName ? `Hey ${data.firstName}` : "Loyalty & Rewards"}
        </h1>
        <p className="text-sm text-muted mt-0.5">{tier.greeting}</p>
      </div>

      {/* Tier Hero Card — full width */}
      <TierHeroCard
        totalPoints={data.totalPoints}
        tier={tier}
        isMaxTier={isMaxTier}
        progress={progress}
        pointsToNext={pointsToNext}
      />

      {/* Two-column layout on xl screens */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Left column: 3/5 */}
        <div className="xl:col-span-3 space-y-4">
          <PerksCard
            tierName={tier.name}
            nextTierName={tier.nextName}
            isMaxTier={isMaxTier}
            pointsToNext={pointsToNext}
            currentPerks={currentPerks}
          />
          <EarnCard />
        </div>

        {/* Right column: 2/5 */}
        <div className="xl:col-span-2 space-y-4">
          {data.membership && <MembershipCard membership={data.membership} />}

          <PendingRedemptions
            pendingRedemptions={data.pendingRedemptions}
            onCancelRedemption={handleCancelRedemption}
            isRedeeming={isRedeeming}
          />

          <RedeemPointsCard
            rewards={data.rewards}
            totalPoints={data.totalPoints}
            redeemedLabel={redeemedLabel}
            redeemError={redeemError}
            isRedeeming={isRedeeming}
            onRedeem={handleRedeem}
          />

          <ReferralCard
            referralCode={data.referralCode}
            referralCount={data.referralCount}
            copied={copied}
            onCopyCode={copyCode}
          />
        </div>
      </div>

      {/* Transaction History — full width */}
      <PointsHistory transactions={data.transactions} />

      {/* Footer */}
      <p className="text-[11px] text-muted text-center pb-2">
        Points never expire. Redeem at checkout for discounts on services, add-ons, and shop orders.
      </p>
    </div>
  );
}
