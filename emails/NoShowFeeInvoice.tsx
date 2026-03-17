import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type NoShowFeeInvoiceProps = {
  clientName: string;
  serviceName: string;
  bookingDate: string;
  feeAmountInCents: number;
  feeType: "no_show" | "late_cancellation";
};

export function NoShowFeeInvoice({
  clientName,
  serviceName,
  bookingDate,
  feeAmountInCents,
  feeType,
}: NoShowFeeInvoiceProps) {
  const title = feeType === "no_show" ? "No-Show Fee Invoice" : "Late Cancellation Fee Invoice";
  const reason =
    feeType === "no_show"
      ? "you missed your scheduled appointment"
      : "your appointment was cancelled within the cancellation window";

  return (
    <Layout preview={`${title} — ${formatCents(feeAmountInCents)}`}>
      <Section style={content}>
        <Text style={heading}>{title}</Text>
        <Text style={paragraph}>
          Hey {clientName}, because {reason}, a fee of{" "}
          <strong>{formatCents(feeAmountInCents)}</strong> has been applied per our cancellation
          policy.
        </Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Appointment Date</Text>
        <Text style={detailValue}>{bookingDate}</Text>

        <Text style={detailLabel}>Amount Due</Text>
        <Text style={detailValue}>{formatCents(feeAmountInCents)}</Text>

        <Text style={paragraph}>
          We were unable to charge this fee to a card on file. Please contact us to arrange payment
          or reply to this email with any questions.
        </Text>
      </Section>
    </Layout>
  );
}

export default NoShowFeeInvoice;

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
