import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type ReviewRequestProps = {
  clientName: string;
  serviceName: string;
};

export function ReviewRequest({ clientName, serviceName }: ReviewRequestProps) {
  return (
    <Layout preview={`How was your ${serviceName}?`}>
      <Section style={content}>
        <Text style={heading}>How Was Your Experience?</Text>
        <Text style={paragraph}>
          Hey {clientName}, it&apos;s been a day since your {serviceName} appointment and we&apos;d
          love to hear how everything turned out!
        </Text>

        <Text style={paragraph}>
          Your feedback means the world to us and helps us keep improving. Just reply to this email
          to share your thoughts — we read every response.
        </Text>

        <Text style={paragraph}>
          If you loved your experience, we&apos;d really appreciate a review on Google or Yelp. It
          helps other clients find us!
        </Text>

        <Text style={muted}>Ready to book again? Reply to this email or visit our site.</Text>
      </Section>
    </Layout>
  );
}

export default ReviewRequest;

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
