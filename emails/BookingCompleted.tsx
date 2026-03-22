import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type BookingCompletedProps = {
  clientName: string;
  serviceName: string;
  businessName?: string;
  /** Absolute URL to the PDF receipt download. */
  receiptUrl?: string;
};

export function BookingCompleted({
  clientName,
  serviceName,
  businessName = "T Creative Studio",
  receiptUrl,
}: BookingCompletedProps) {
  return (
    <Layout preview={`Thanks for visiting — ${serviceName}`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Thanks for Visiting!</Text>
        <Text style={paragraph}>
          Hey {clientName}, thank you for your {serviceName} appointment! We hope you loved the
          result.
        </Text>

        {receiptUrl && (
          <Text style={paragraph}>
            <a href={receiptUrl} style={link}>
              Download your receipt →
            </a>
          </Text>
        )}

        <Text style={paragraph}>
          We&apos;d love to hear how it went — feel free to reply to this email with any feedback.
          Your input helps us keep improving!
        </Text>

        <Text style={muted}>Ready to book again? Visit our site or reply to this email.</Text>
      </Section>
    </Layout>
  );
}

export default BookingCompleted;

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

const link: React.CSSProperties = {
  color: "#96604a",
  fontWeight: "600",
  textDecoration: "none",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
