import * as React from "react";
import { Section, Text, Button } from "@react-email/components";
import { Layout } from "./components/Layout";

export type EventInviteEmailProps = {
  eventTitle: string;
  eventDate: string;
  eventLocation: string | null;
  services: string | null;
  rsvpUrl: string;
  businessName?: string;
};

export function EventInviteEmail({
  eventTitle,
  eventDate,
  eventLocation,
  services,
  rsvpUrl,
  businessName = "T Creative Studio",
}: EventInviteEmailProps) {
  return (
    <Layout preview={`You're invited — ${eventTitle}`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>You&apos;re invited!</Text>
        <Text style={paragraph}>
          {businessName} would love to see you at <strong>{eventTitle}</strong>.
        </Text>

        <div style={details}>
          <Text style={detailItem}>
            <strong>Date:</strong> {eventDate}
          </Text>
          {eventLocation && (
            <Text style={detailItem}>
              <strong>Location:</strong> {eventLocation}
            </Text>
          )}
          {services && (
            <Text style={detailItem}>
              <strong>Services offered:</strong> {services}
            </Text>
          )}
        </div>

        <Text style={paragraph}>
          Click the button below to RSVP and let us know you&apos;re coming. Spots are limited!
        </Text>

        <Button href={rsvpUrl} style={button}>
          RSVP Now
        </Button>

        <Text style={muted}>
          This invitation was sent by {businessName}. If you have questions, reply to this email.
        </Text>
      </Section>
    </Layout>
  );
}

export default EventInviteEmail;

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

const details: React.CSSProperties = {
  backgroundColor: "#f9f6f3",
  borderRadius: "6px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const detailItem: React.CSSProperties = {
  fontSize: "13px",
  color: "#555555",
  margin: "4px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#c4907a",
  color: "#ffffff",
  padding: "12px 28px",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: "600",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "24px",
};

const muted: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: "20px 0 0",
};
