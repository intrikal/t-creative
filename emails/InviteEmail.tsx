import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type InviteEmailProps = {
  inviteUrl: string;
  email: string;
};

export function InviteEmail({ inviteUrl }: InviteEmailProps) {
  return (
    <Layout preview="You're invited to join T Creative Studio">
      <Section style={content}>
        <Text style={heading}>You&apos;re Invited!</Text>
        <Text style={paragraph}>
          You&apos;ve been invited to join the T Creative Studio team as an assistant. Click the
          button below to create your account and get started.
        </Text>

        <Button href={inviteUrl}>Accept Invitation</Button>

        <Text style={muted}>
          This invitation expires in 48 hours. If you didn&apos;t expect this, you can safely ignore
          it.
        </Text>
      </Section>
    </Layout>
  );
}

export default InviteEmail;

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
