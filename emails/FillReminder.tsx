import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type FillReminderProps = {
  clientName: string | null;
  lastVisitDate: string;
  bookingUrl: string;
};

export function FillReminder({ clientName, lastVisitDate, bookingUrl }: FillReminderProps) {
  return (
    <Layout preview="Time for your lash fill — book before your extensions shed">
      <Section style={content}>
        <Text style={heading}>Time for Your Lash Fill ✨</Text>
        <Text style={paragraph}>
          Hey {clientName ?? "there"}! It&apos;s been about 3 weeks since your last lash appointment
          on {lastVisitDate}.
        </Text>
        <Text style={paragraph}>
          Lash fills are recommended every 2–3 weeks to keep your set looking full and fresh. If you
          wait too long, more extensions will have shed and you may need a full set instead.
        </Text>
        <Text style={ctaWrapper}>
          <a href={bookingUrl} style={cta}>
            Book Your Fill Now →
          </a>
        </Text>
        <Text style={muted}>
          Already booked or not ready yet? No worries — we&apos;ll see you when the time is right.
          Feel free to reply to this email if you have any questions.
        </Text>
      </Section>
    </Layout>
  );
}

export default FillReminder;

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

const ctaWrapper: React.CSSProperties = {
  margin: "24px 0",
};

const cta: React.CSSProperties = {
  backgroundColor: "#c4907a",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "600",
  fontSize: "14px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
