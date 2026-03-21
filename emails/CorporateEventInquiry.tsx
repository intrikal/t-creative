import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type CorporateEventInquiryProps = {
  contactName: string;
  email: string;
  phone?: string;
  companyName: string;
  eventType: string;
  services: string;
  headcount: number;
  preferredDate?: string;
  details?: string;
  businessName?: string;
};

export function CorporateEventInquiry({
  contactName,
  email,
  phone,
  companyName,
  eventType,
  services,
  headcount,
  preferredDate,
  details,
  businessName = "T Creative Studio",
}: CorporateEventInquiryProps) {
  return (
    <Layout preview={`New corporate event inquiry — ${companyName}`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>New Corporate Event Inquiry</Text>
        <Text style={paragraph}>
          A new corporate event inquiry has been submitted. Review the details below.
        </Text>

        <Text style={detailLabel}>Contact</Text>
        <Text style={detailValue}>{contactName}</Text>

        <Text style={detailLabel}>Email</Text>
        <Text style={detailValue}>{email}</Text>

        {phone && (
          <>
            <Text style={detailLabel}>Phone</Text>
            <Text style={detailValue}>{phone}</Text>
          </>
        )}

        <Text style={detailLabel}>Company</Text>
        <Text style={detailValue}>{companyName}</Text>

        <Text style={detailLabel}>Event Type</Text>
        <Text style={detailValue}>{eventType}</Text>

        <Text style={detailLabel}>Services Requested</Text>
        <Text style={detailValue}>{services}</Text>

        <Text style={detailLabel}>Estimated Headcount</Text>
        <Text style={detailValue}>{headcount}</Text>

        {preferredDate && (
          <>
            <Text style={detailLabel}>Preferred Date</Text>
            <Text style={detailValue}>{preferredDate}</Text>
          </>
        )}

        {details && (
          <>
            <Text style={detailLabel}>Additional Details</Text>
            <Text style={quotedText}>{details}</Text>
          </>
        )}
      </Section>
    </Layout>
  );
}

export default CorporateEventInquiry;

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
  margin: "0 0 16px",
};
