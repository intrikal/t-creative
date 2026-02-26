import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type BookingRescheduleProps = {
  clientName: string;
  serviceName: string;
  oldDateTime: string;
  newDateTime: string;
};

export function BookingReschedule({
  clientName,
  serviceName,
  oldDateTime,
  newDateTime,
}: BookingRescheduleProps) {
  return (
    <Layout preview={`Booking rescheduled — ${serviceName}`}>
      <Section style={content}>
        <Text style={heading}>Booking Rescheduled</Text>
        <Text style={paragraph}>Hey {clientName}, your appointment has been rescheduled.</Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Previous Time</Text>
        <Text style={oldValue}>{oldDateTime}</Text>

        <Text style={detailLabel}>New Time</Text>
        <Text style={detailValue}>{newDateTime}</Text>

        <Text style={muted}>Need to make changes? Reply to this email or contact us directly.</Text>
      </Section>
    </Layout>
  );
}

export default BookingReschedule;

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

const oldValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#888888",
  textDecoration: "line-through",
  margin: "0 0 12px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
