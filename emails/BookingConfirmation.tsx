import * as React from "react";
import { Section, Text } from "@react-email/components";
import { formatCents } from "./components/format";
import { Layout } from "./components/Layout";

export type BookingConfirmationProps = {
  clientName: string;
  serviceName: string;
  startsAt: string;
  durationMinutes: number;
  totalInCents: number;
};

export function BookingConfirmation({
  clientName,
  serviceName,
  startsAt,
  durationMinutes,
  totalInCents,
}: BookingConfirmationProps) {
  return (
    <Layout preview={`Booking confirmed — ${serviceName}`}>
      <Section style={content}>
        <Text style={heading}>Booking Confirmed</Text>
        <Text style={paragraph}>Hey {clientName}, your appointment is confirmed!</Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>When</Text>
        <Text style={detailValue}>{startsAt}</Text>

        <Text style={detailLabel}>Duration</Text>
        <Text style={detailValue}>{durationMinutes} minutes</Text>

        <Text style={detailLabel}>Total</Text>
        <Text style={detailValue}>{formatCents(totalInCents)}</Text>

        <Text style={muted}>
          Need to reschedule or cancel? Reply to this email or contact us directly.
        </Text>
      </Section>
    </Layout>
  );
}

export default BookingConfirmation;

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
