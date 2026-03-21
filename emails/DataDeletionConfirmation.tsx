import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type DataDeletionConfirmationProps = {
  clientName: string;
  businessName?: string;
};

export function DataDeletionConfirmation({
  clientName,
  businessName = "T Creative Studio",
}: DataDeletionConfirmationProps) {
  return (
    <Layout preview="Your data deletion request has been processed" businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Data Deletion Confirmation</Text>
        <Text style={paragraph}>
          Hi {clientName}, this email confirms that your data deletion request has been processed in
          accordance with the California Consumer Privacy Act (CCPA).
        </Text>

        <Text style={subheading}>What was removed:</Text>
        <Text style={listItem}>Your profile has been anonymized (name, email, phone, birthday)</Text>
        <Text style={listItem}>Loyalty points and transaction history have been voided</Text>
        <Text style={listItem}>Active memberships have been cancelled</Text>
        <Text style={listItem}>Gallery photos have been permanently deleted</Text>
        <Text style={listItem}>Notification preferences and referral codes have been removed</Text>

        <Text style={subheading}>What is retained (as required by law):</Text>
        <Text style={listItem}>
          Completed booking records (displayed as &quot;Deleted User&quot;)
        </Text>
        <Text style={listItem}>Payment and financial transaction records for tax compliance</Text>
        <Text style={listItem}>Audit logs for regulatory compliance</Text>

        <Text style={muted}>
          This is the final email you will receive from {businessName}. Your account credentials have
          been permanently removed and you will no longer be able to sign in.
        </Text>
        <Text style={muted}>
          If you did not request this deletion or have questions, please contact us immediately.
        </Text>
      </Section>
    </Layout>
  );
}

export default DataDeletionConfirmation;

const content: React.CSSProperties = {
  padding: "0 40px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "0 0 12px",
};

const subheading: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "20px 0 8px",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#333333",
  margin: "0 0 16px",
};

const listItem: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#333333",
  margin: "0 0 4px",
  paddingLeft: "12px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
