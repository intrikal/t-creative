import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type RefundNotificationProps = {
  clientName: string;
  refundAmountInCents: number;
  originalAmountInCents: number;
  method: string;
  reason?: string;
  serviceName: string;
};

export function RefundNotification({
  clientName,
  refundAmountInCents,
  originalAmountInCents,
  method,
  reason,
  serviceName,
}: RefundNotificationProps) {
  return (
    <Layout preview={`Refund processed — ${formatCents(refundAmountInCents)}`}>
      <Section style={content}>
        <Text style={heading}>Refund Processed</Text>
        <Text style={paragraph}>Hey {clientName}, your refund has been processed.</Text>

        <Text style={detailLabel}>Refund Amount</Text>
        <Text style={detailValue}>{formatCents(refundAmountInCents)}</Text>

        <Text style={detailLabel}>Original Payment</Text>
        <Text style={detailValue}>{formatCents(originalAmountInCents)}</Text>

        <Text style={detailLabel}>For</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Method</Text>
        <Text style={detailValue}>{method}</Text>

        {reason && (
          <>
            <Text style={detailLabel}>Reason</Text>
            <Text style={detailValue}>{reason}</Text>
          </>
        )}

        <Text style={muted}>
          Refunds typically take 5–10 business days to appear on your statement.
        </Text>
      </Section>
    </Layout>
  );
}

export default RefundNotification;

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
