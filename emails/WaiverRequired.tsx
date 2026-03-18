import * as React from "react";
import { Section, Text, Button } from "@react-email/components";
import { Layout } from "./components/Layout";

export type WaiverRequiredProps = {
  clientName: string;
  serviceName: string;
  appointmentDate: string;
  waiverUrl: string;
};

export function WaiverRequired({
  clientName,
  serviceName,
  appointmentDate,
  waiverUrl,
}: WaiverRequiredProps) {
  return (
    <Layout preview={`Action required — complete your waiver for ${serviceName}`}>
      <Section style={content}>
        <Text style={heading}>Waiver Required</Text>
        <Text style={paragraph}>
          Hey {clientName}, before we can confirm your upcoming appointment you&apos;ll need to
          complete a required consent waiver.
        </Text>

        <Text style={detailLabel}>Service</Text>
        <Text style={detailValue}>{serviceName}</Text>

        <Text style={detailLabel}>Appointment</Text>
        <Text style={detailValue}>{appointmentDate}</Text>

        <Text style={paragraph}>
          For your safety, we require all clients to review and sign our service waiver before their
          first appointment. This covers important information about the procedure, aftercare, and
          your rights.
        </Text>

        <Button href={waiverUrl} style={button}>
          Complete Your Waiver
        </Button>

        <Text style={muted}>
          This link expires in 7 days. If you have any questions, reply to this email or contact us
          directly.
        </Text>
      </Section>
    </Layout>
  );
}

export default WaiverRequired;

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

const button: React.CSSProperties = {
  backgroundColor: "#96604a",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
  margin: "8px 0 24px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "0",
};
