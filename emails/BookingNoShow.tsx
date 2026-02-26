import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type BookingNoShowProps = {
  clientName: string;
  serviceName: string;
  bookingDate: string;
};

export function BookingNoShow({ clientName, serviceName, bookingDate }: BookingNoShowProps) {
  return (
    <Layout preview={`Missed appointment — ${serviceName}`}>
      <Section style={content}>
        <Text style={heading}>Missed Appointment</Text>
        <Text style={paragraph}>Hey {clientName}, it looks like you missed your appointment.</Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Scheduled Date</Text>
        <Text style={detailValue}>{bookingDate}</Text>

        <Text style={paragraph}>
          We understand things come up! If you&apos;d like to rebook, just reply to this email or
          contact us directly.
        </Text>
      </Section>
    </Layout>
  );
}

export default BookingNoShow;

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
