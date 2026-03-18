/**
 * ReferralCard.tsx — "Share the Love" referral code section.
 *
 * Displays the client's referral code with a copy-to-clipboard button,
 * or a placeholder message if no referral code is available yet.
 */

import { Check, Copy, Heart, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ReferralCardProps {
  referralCode: string;
  referralCount: number;
  copied: boolean;
  onCopyCode: () => void;
}

export function ReferralCard({
  referralCode,
  referralCount,
  copied,
  onCopyCode,
}: ReferralCardProps) {
  return (
    <Card className="gap-0">
      <CardContent className="px-5 pb-5 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Share the Love</p>
        </div>

        {referralCode ? (
          <>
            <p className="text-xs text-muted">
              Give your code to a friend — you both earn bonus points when they book.
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg font-mono text-sm text-foreground tracking-wide text-center">
                {referralCode}
              </div>
              <button
                onClick={onCopyCode}
                className="px-3 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {referralCount > 0 && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-accent/8 border border-accent/15">
                <Users className="w-4 h-4 text-accent shrink-0" />
                <p className="text-xs text-foreground">
                  You&apos;ve brought <span className="font-semibold">{referralCount}</span>{" "}
                  {referralCount === 1 ? "friend" : "friends"} to T Creative
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="py-3 text-center">
            <Users className="w-7 h-7 text-muted/30 mx-auto mb-2" />
            <p className="text-xs text-muted">
              Your referral code will be ready after your first booking.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
