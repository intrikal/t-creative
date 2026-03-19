import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type GiftCardPurchaseProps = {
  clientName: string;
  giftCardCode: string;
  amountInCents: number;
  recipientName?: string;
  expiresAt?: string;
  businessName?: string;
};

export function GiftCardPurchase({
  clientName,
  giftCardCode,
  amountInCents,
  recipientName,
  expiresAt,
  businessName = "T Creative Studio",
}: GiftCardPurchaseProps) {
  return (
    <Layout preview={`Gift card purchased — ${giftCardCode}`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Gift Card Purchased</Text>
        <Text style={paragraph}>
          Hey {clientName}, thanks for purchasing a {businessName} gift card!
        </Text>

        <Text style={detailLabel}>Gift Card Code</Text>
        <Text style={detailValue}>{giftCardCode}</Text>

        <Text style={detailLabel}>Amount</Text>
        <Text style={detailValue}>{formatCents(amountInCents)}</Text>

        {recipientName && (
          <>
            <Text style={detailLabel}>Recipient</Text>
            <Text style={detailValue}>{recipientName}</Text>
          </>
        )}

        {expiresAt && (
          <>
            <Text style={detailLabel}>Expires</Text>
            <Text style={detailValue}>{expiresAt}</Text>
          </>
        )}

        <Text style={paragraph}>
          This gift card can be redeemed toward any service or product at {businessName}.
        </Text>

        <Text style={muted}>
          Questions about your gift card? Reply to this email or contact us directly.
        </Text>
      </Section>
    </Layout>
  );
}

export default GiftCardPurchase;

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
