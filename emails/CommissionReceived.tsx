import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type CommissionReceivedProps = {
  clientName: string;
  orderNumber: string;
  title: string;
  category: string;
};

const categoryLabel: Record<string, string> = {
  crochet: "Custom Crochet",
  "3d_printing": "3D Printing",
};

export function CommissionReceived({
  clientName,
  orderNumber,
  title,
  category,
}: CommissionReceivedProps) {
  const catLabel = categoryLabel[category] ?? category;

  return (
    <Layout preview={`Commission request received — ${orderNumber}`}>
      <Section style={content}>
        <Text style={heading}>Commission Request Received</Text>
        <Text style={paragraph}>
          Hey {clientName}, we&apos;ve received your commission request and we&apos;re excited to
          bring your vision to life!
        </Text>

        <Text style={detailLabel}>Request</Text>
        <Text style={detailValue}>{title}</Text>

        <Text style={detailLabel}>Category</Text>
        <Text style={detailValue}>{catLabel}</Text>

        <Text style={detailLabel}>Reference #</Text>
        <Text style={detailValue}>{orderNumber}</Text>

        <Text style={paragraph}>
          We&apos;ll review your request and send you a quote within 2–3 business days. You&apos;ll
          be able to accept or decline the quote directly from your dashboard.
        </Text>

        <Text style={muted}>Questions? Reply to this email or reach out to us directly.</Text>
      </Section>
    </Layout>
  );
}

export default CommissionReceived;

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
