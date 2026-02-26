import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type BookingCancellationProps = {
  clientName: string;
  serviceName: string;
  bookingDate: string;
  cancellationReason?: string;
};

export function BookingCancellation({
  clientName,
  serviceName,
  bookingDate,
  cancellationReason,
}: BookingCancellationProps) {
  return (
    <Layout preview={`Booking cancelled — ${serviceName}`}>
      <Section style={content}>
        <Text style={heading}>Booking Cancelled</Text>
        <Text style={paragraph}>Hey {clientName}, your appointment has been cancelled.</Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Original Date</Text>
        <Text style={detailValue}>{bookingDate}</Text>

        {cancellationReason && (
          <>
            <Text style={detailLabel}>Reason</Text>
            <Text style={detailValue}>{cancellationReason}</Text>
          </>
        )}

        <Text style={paragraph}>
          Want to rebook? Reply to this email or contact us directly — we&apos;d love to reschedule.
        </Text>
      </Section>
    </Layout>
  );
}

export default BookingCancellation;

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
