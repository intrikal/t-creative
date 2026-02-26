import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type MessageNotificationProps = {
  recipientName: string;
  senderName: string;
  threadSubject: string;
  messagePreview: string;
  threadUrl: string;
};

export function MessageNotification({
  recipientName,
  senderName,
  threadSubject,
  messagePreview,
  threadUrl,
}: MessageNotificationProps) {
  return (
    <Layout preview={`New message — ${threadSubject}`}>
      <Section style={content}>
        <Text style={heading}>New Message</Text>
        <Text style={paragraph}>
          Hey {recipientName}, {senderName} sent you a message.
        </Text>

        <Text style={detailLabel}>Subject</Text>
        <Text style={detailValue}>{threadSubject}</Text>

        <Text style={detailLabel}>Message</Text>
        <Text style={quotedText}>{messagePreview}</Text>

        <Button href={threadUrl}>View Conversation</Button>
      </Section>
    </Layout>
  );
}

export default MessageNotification;

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

const quotedText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#888888",
  fontStyle: "italic",
  borderLeft: "3px solid #e6e6e6",
  paddingLeft: "12px",
  margin: "0 0 20px",
};
