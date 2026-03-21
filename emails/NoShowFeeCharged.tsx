import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type NoShowFeeChargedProps = {
  clientName: string;
  serviceName: string;
  bookingDate: string;
  feeAmountInCents: number;
  feeType: "no_show" | "late_cancellation";
  receiptUrl?: string;
  businessName?: string;
};

export function NoShowFeeCharged({
  clientName,
  serviceName,
  bookingDate,
  feeAmountInCents,
  feeType,
  receiptUrl,
  businessName = "T Creative Studio",
}: NoShowFeeChargedProps) {
  const title = feeType === "no_show" ? "No-Show Fee Charged" : "Late Cancellation Fee Charged";
  const reason =
    feeType === "no_show"
      ? "you missed your scheduled appointment"
      : "your appointment was cancelled within the cancellation window";

  return (
    <Layout preview={`${title} — ${formatCents(feeAmountInCents)}`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>{title}</Text>
        <Text style={paragraph}>
          Hey {clientName}, because {reason}, a fee has been charged to your card on file per our
          cancellation policy.
        </Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Appointment Date</Text>
        <Text style={detailValue}>{bookingDate}</Text>

        <Text style={detailLabel}>Fee Charged</Text>
        <Text style={detailValue}>{formatCents(feeAmountInCents)}</Text>

        {receiptUrl && (
          <>
            <Text style={paragraph}>View your receipt for this charge:</Text>
            <Button href={receiptUrl}>View Receipt</Button>
          </>
        )}

        <Text style={paragraph}>
          If you have questions about this charge, please reply to this email or contact us
          directly.
        </Text>
      </Section>
    </Layout>
  );
}

export default NoShowFeeCharged;

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
