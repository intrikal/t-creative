import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type TimeOffDeniedProps = {
  staffName: string;
  startDate: string;
  endDate: string;
  deniedReason?: string;
  businessName?: string;
};

export function TimeOffDenied({
  staffName,
  startDate,
  endDate,
  deniedReason,
  businessName = "T Creative Studio",
}: TimeOffDeniedProps) {
  const dateLabel = startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  return (
    <Layout preview="Your time-off request has been denied" businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Time-Off Request Denied</Text>
        <Text style={paragraph}>Hi {staffName}, your time-off request has been reviewed.</Text>

        <Text style={detailLabel}>Requested Dates</Text>
        <Text style={detailValue}>{dateLabel}</Text>

        {deniedReason && (
          <>
            <Text style={detailLabel}>Reason</Text>
            <Text style={detailValue}>{deniedReason}</Text>
          </>
        )}

        <Text style={paragraph}>
          If you have questions, please reach out to the studio directly.
        </Text>
      </Section>
    </Layout>
  );
}

export default TimeOffDenied;

const content: React.CSSProperties = { padding: "0 40px" };

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
