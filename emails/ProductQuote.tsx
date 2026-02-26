import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type ProductQuoteProps = {
  clientName: string;
  productTitle: string;
  quotedAmountInCents: number;
};

export function ProductQuote({ clientName, productTitle, quotedAmountInCents }: ProductQuoteProps) {
  return (
    <Layout preview={`Quote — ${productTitle}`}>
      <Section style={content}>
        <Text style={heading}>Your Quote is Ready</Text>
        <Text style={paragraph}>
          Hey {clientName}, here&apos;s your quote for <strong>{productTitle}</strong>.
        </Text>

        <Text style={detailLabel}>Product</Text>
        <Text style={detailValue}>{productTitle}</Text>

        <Text style={detailLabel}>Quoted Price</Text>
        <Text style={detailValue}>{formatCents(quotedAmountInCents)}</Text>

        <Text style={paragraph}>
          To move forward, just reply to this email or reach out to us directly. We&apos;d love to
          make this for you!
        </Text>

        <Text style={muted}>This quote is valid for 30 days from the date of this email.</Text>
      </Section>
    </Layout>
  );
}

export default ProductQuote;

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
