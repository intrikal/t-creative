import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type ReferralBonusProps = {
  referrerName: string;
  refereeName: string;
  pointsEarned: number;
};

export function ReferralBonus({ referrerName, refereeName, pointsEarned }: ReferralBonusProps) {
  return (
    <Layout preview={`Referral bonus — ${pointsEarned} points earned!`}>
      <Section style={content}>
        <Text style={heading}>Referral Bonus!</Text>
        <Text style={paragraph}>
          Hey {referrerName}, {refereeName} just signed up using your referral and you earned{" "}
          {pointsEarned} loyalty points!
        </Text>

        <Text style={detailLabel}>Points Earned</Text>
        <Text style={detailValue}>+{pointsEarned} pts</Text>

        <Text style={detailLabel}>Referred</Text>
        <Text style={detailValue}>{refereeName}</Text>

        <Text style={paragraph}>Keep sharing your referral code to earn more points!</Text>
      </Section>
    </Layout>
  );
}

export default ReferralBonus;

const content: React.CSSProperties = {
  padding: "0 40px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "0 0 12px",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#333333",
  margin: "0 0 20px",
};

const detailLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#888888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 2px",
};

const detailValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "0 0 12px",
};
