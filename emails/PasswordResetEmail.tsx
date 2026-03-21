import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type PasswordResetEmailProps = {
  resetUrl: string;
  businessName?: string;
};

export function PasswordResetEmail({
  resetUrl,
  businessName = "T Creative Studio",
}: PasswordResetEmailProps) {
  return (
    <Layout preview="Reset your password" businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Reset Your Password</Text>
        <Text style={paragraph}>
          We received a request to reset the password for your {businessName} account. Click the
          button below to choose a new password.
        </Text>

        <Button href={resetUrl}>Reset Password</Button>

        <Text style={muted}>
          This link expires in 1 hour. If you didn&apos;t request a password reset, you can safely
          ignore this email — your account remains secure.
        </Text>
      </Section>
    </Layout>
  );
}

export default PasswordResetEmail;

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
