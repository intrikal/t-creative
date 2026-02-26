import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type PaymentLinkEmailProps = {
  clientName: string;
  serviceName: string;
  amountInCents: number;
  type: "deposit" | "balance";
  paymentUrl: string;
};

export function PaymentLinkEmail({
  clientName,
  serviceName,
  amountInCents,
  type,
  paymentUrl,
}: PaymentLinkEmailProps) {
  const label = type === "deposit" ? "deposit" : "remaining balance";

  return (
    <Layout preview={`${type === "deposit" ? "Deposit" : "Payment"} link — ${serviceName}`}>
      <Section style={content}>
        <Text style={heading}>{type === "deposit" ? "Deposit Request" : "Payment Request"}</Text>
        <Text style={paragraph}>
          Hey {clientName}, here&apos;s your {label} payment link for <strong>{serviceName}</strong>
          .
        </Text>

        <Text style={detailLabel}>Amount Due</Text>
        <Text style={detailValue}>{formatCents(amountInCents)}</Text>

        <Button href={paymentUrl}>Pay {formatCents(amountInCents)}</Button>

        <Text style={muted}>This link will take you to a secure Square checkout page.</Text>
      </Section>
    </Layout>
  );
}

export default PaymentLinkEmail;

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
  margin: "0 0 16px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
