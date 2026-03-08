import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type GiftCardDeliveryProps = {
  recipientName: string;
  senderName: string;
  giftCardCode: string;
  amountInCents: number;
  expiresAt?: string;
};

export function GiftCardDelivery({
  recipientName,
  senderName,
  giftCardCode,
  amountInCents,
  expiresAt,
}: GiftCardDeliveryProps) {
  return (
    <Layout preview={`You received a ${formatCents(amountInCents)} gift card!`}>
      <Section style={content}>
        <Text style={heading}>You Got a Gift Card!</Text>
        <Text style={paragraph}>
          Hey {recipientName}, {senderName} sent you a T Creative Studio gift card!
        </Text>

        <Text style={detailLabel}>Gift Card Code</Text>
        <Text style={detailValue}>{giftCardCode}</Text>

        <Text style={detailLabel}>Amount</Text>
        <Text style={detailValue}>{formatCents(amountInCents)}</Text>

        {expiresAt && (
          <>
            <Text style={detailLabel}>Expires</Text>
            <Text style={detailValue}>{expiresAt}</Text>
          </>
        )}

        <Text style={paragraph}>
          Use this gift card toward any service — lash extensions, permanent jewelry, crochet
          pieces, or consulting sessions. Just share the code when booking!
        </Text>

        <Text style={muted}>
          Questions? Reply to this email or contact us at T Creative Studio.
        </Text>
      </Section>
    </Layout>
  );
}

export default GiftCardDelivery;

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
