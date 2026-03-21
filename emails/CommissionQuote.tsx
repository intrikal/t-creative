import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type CommissionQuoteProps = {
  clientName: string;
  orderNumber: string;
  title: string;
  quotedAmountInCents: number;
  estimatedCompletion?: string;
  notes?: string;
  businessName?: string;
};

export function CommissionQuote({
  clientName,
  orderNumber,
  title,
  quotedAmountInCents,
  estimatedCompletion,
  notes,
  businessName = "T Creative Studio",
}: CommissionQuoteProps) {
  return (
    <Layout preview={`Your quote for ${title} is ready`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Your Quote is Ready</Text>
        <Text style={paragraph}>
          Hey {clientName}, here&apos;s your custom quote for <strong>{title}</strong>.
        </Text>

        <Text style={detailLabel}>Commission</Text>
        <Text style={detailValue}>{title}</Text>

        <Text style={detailLabel}>Quoted Price</Text>
        <Text style={detailValue}>{formatCents(quotedAmountInCents)}</Text>

        {estimatedCompletion && (
          <>
            <Text style={detailLabel}>Estimated Completion</Text>
            <Text style={detailValue}>{estimatedCompletion}</Text>
          </>
        )}

        {notes && (
          <>
            <Text style={detailLabel}>Notes</Text>
            <Text style={detailValue}>{notes}</Text>
          </>
        )}

        <Text style={paragraph}>
          Log in to your dashboard to accept or decline this quote. This quote is valid for 14 days.
        </Text>

        <Text style={muted}>Reference: {orderNumber}</Text>
      </Section>
    </Layout>
  );
}

export default CommissionQuote;

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
