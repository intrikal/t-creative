import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type PaymentReceiptProps = {
  clientName: string;
  amountInCents: number;
  method: string;
  receiptUrl?: string;
  description: string;
};

export function PaymentReceipt({
  clientName,
  amountInCents,
  method,
  receiptUrl,
  description,
}: PaymentReceiptProps) {
  return (
    <Layout preview={`Payment received — ${formatCents(amountInCents)}`}>
      <Section style={content}>
        <Text style={heading}>Payment Received</Text>
        <Text style={paragraph}>Hey {clientName}, we received your payment. Thank you!</Text>

        <Text style={detailLabel}>Amount</Text>
        <Text style={detailValue}>{formatCents(amountInCents)}</Text>

        <Text style={detailLabel}>Method</Text>
        <Text style={detailValue}>{method}</Text>

        <Text style={detailLabel}>For</Text>
        <Text style={detailValue}>{description}</Text>

        {receiptUrl && (
          <>
            <Text style={paragraph}>View your full receipt:</Text>
            <Button href={receiptUrl}>View Receipt</Button>
          </>
        )}
      </Section>
    </Layout>
  );
}

export default PaymentReceipt;

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
  margin: "0 0 16px",
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
