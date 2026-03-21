import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type MagicLinkEmailProps = {
  clientName: string;
  magicLinkUrl: string;
  businessName?: string;
};

export function MagicLinkEmail({
  clientName,
  magicLinkUrl,
  businessName = "T Creative Studio",
}: MagicLinkEmailProps) {
  return (
    <Layout preview={`Your sign-in link for ${businessName}`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Your Sign-In Link</Text>
        <Text style={paragraph}>
          Hey {clientName}! Click the button below to sign in to your {businessName} client portal —
          no password needed.
        </Text>

        <Button href={magicLinkUrl}>Sign In to Your Portal</Button>

        <Text style={muted}>
          This link expires in 1 hour and can only be used once. If you didn&apos;t request this,
          you can safely ignore this email.
        </Text>
      </Section>
    </Layout>
  );
}

export default MagicLinkEmail;

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
  margin: "0 0 24px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
