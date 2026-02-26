import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type LoyaltyPointsAwardedProps = {
  clientName: string;
  pointsEarned: number;
  reason: string;
  totalBalance: number;
};

export function LoyaltyPointsAwarded({
  clientName,
  pointsEarned,
  reason,
  totalBalance,
}: LoyaltyPointsAwardedProps) {
  return (
    <Layout preview={`You earned ${pointsEarned} loyalty points!`}>
      <Section style={content}>
        <Text style={heading}>Points Earned!</Text>
        <Text style={paragraph}>Hey {clientName}, you just earned loyalty points!</Text>

        <Text style={detailLabel}>Points Earned</Text>
        <Text style={detailValue}>+{pointsEarned} pts</Text>

        <Text style={detailLabel}>Reason</Text>
        <Text style={detailValue}>{reason}</Text>

        <Text style={detailLabel}>Total Balance</Text>
        <Text style={detailValue}>{totalBalance} pts</Text>

        <Text style={muted}>Keep earning points with every visit and purchase!</Text>
      </Section>
    </Layout>
  );
}

export default LoyaltyPointsAwarded;

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

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
