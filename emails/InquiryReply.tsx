import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type InquiryReplyProps = {
  clientName: string;
  replyText: string;
  originalMessage: string;
};

export function InquiryReply({ clientName, replyText, originalMessage }: InquiryReplyProps) {
  return (
    <Layout preview="Reply to your inquiry — T Creative">
      <Section style={content}>
        <Text style={heading}>We&apos;ve Replied to Your Inquiry</Text>
        <Text style={paragraph}>Hey {clientName},</Text>

        <Text style={paragraph}>{replyText}</Text>

        <Text style={detailLabel}>Your Original Message</Text>
        <Text style={quotedText}>{originalMessage}</Text>

        <Text style={muted}>Have more questions? Just reply to this email.</Text>
      </Section>
    </Layout>
  );
}

export default InquiryReply;

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

const quotedText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#888888",
  fontStyle: "italic",
  borderLeft: "3px solid #e6e6e6",
  paddingLeft: "12px",
  margin: "0 0 16px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
