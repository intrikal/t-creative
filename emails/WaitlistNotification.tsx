import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type WaitlistNotificationProps = {
  clientName: string;
  serviceName: string;
};

export function WaitlistNotification({ clientName, serviceName }: WaitlistNotificationProps) {
  return (
    <Layout preview={`A spot opened up for ${serviceName}!`}>
      <Section style={content}>
        <Text style={heading}>A Spot Opened Up!</Text>
        <Text style={paragraph}>
          Hey {clientName}, great news — a spot just opened up for <strong>{serviceName}</strong>!
        </Text>

        <Text style={paragraph}>
          Since you were on the waitlist, you get first dibs. Reply to this email or contact us to
          book your appointment before the spot fills up.
        </Text>

        <Text style={muted}>
          No longer interested? No worries — just ignore this email and we&apos;ll remove you from
          the waitlist.
        </Text>
      </Section>
    </Layout>
  );
}

export default WaitlistNotification;

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

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
