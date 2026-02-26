import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type WelcomeEmailProps = {
  clientName: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ clientName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Layout preview="Welcome to T Creative Studio!">
      <Section style={content}>
        <Text style={heading}>Welcome to T Creative!</Text>
        <Text style={paragraph}>
          Hey {clientName}, thanks for joining! Your account is all set up.
        </Text>
        <Text style={paragraph}>
          From your dashboard you can browse our shop, book appointments, track orders, and manage
          your profile.
        </Text>

        <Button href={dashboardUrl}>Go to Dashboard</Button>

        <Text style={muted}>
          Have questions? Just reply to this email — we&apos;d love to hear from you.
        </Text>
      </Section>
    </Layout>
  );
}

export default WelcomeEmail;

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
  margin: "0 0 16px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
