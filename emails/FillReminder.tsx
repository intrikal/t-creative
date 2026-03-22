import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type FillReminderProps = {
  clientName: string | null;
  lastVisitDate: string;
  bookingUrl: string;
  /** The specific service name from their last visit (e.g. "Classic Lash Fill"). */
  serviceName?: string | null;
  /** Their preferred staff member's first name, if consistently assigned. */
  staffName?: string | null;
  /** Most common day-of-week from booking history (e.g. "Saturday"). */
  suggestedDay?: string | null;
  /** Most common time-of-day from booking history (e.g. "10:00 AM"). */
  suggestedTime?: string | null;
  businessName?: string;
};

export function FillReminder({
  clientName,
  lastVisitDate,
  bookingUrl,
  serviceName,
  staffName,
  suggestedDay,
  suggestedTime,
  businessName = "T Creative Studio",
}: FillReminderProps) {
  // Build a personalised suggestion line from available data.
  const suggestionParts: string[] = [];
  if (serviceName) suggestionParts.push(serviceName);
  if (staffName) suggestionParts.push(`with ${staffName}`);
  if (suggestedDay && suggestedTime)
    suggestionParts.push(`on ${suggestedDay} around ${suggestedTime}`);
  else if (suggestedDay) suggestionParts.push(`on a ${suggestedDay}`);
  else if (suggestedTime) suggestionParts.push(`around ${suggestedTime}`);

  const hasSuggestion = suggestionParts.length > 0;

  return (
    <Layout preview="Time for your lash fill — book before your extensions shed">
      <Section style={content}>
        <Text style={heading}>Time for Your Lash Fill</Text>
        <Text style={paragraph}>
          Hey {clientName ?? "there"}! It&apos;s been about 3 weeks since your last lash appointment
          on {lastVisitDate}.
        </Text>
        <Text style={paragraph}>
          Lash fills are recommended every 2–3 weeks to keep your set looking full and fresh. If you
          wait too long, more extensions will have shed and you may need a full set instead.
        </Text>

        {hasSuggestion && (
          <Text style={suggestionBox}>
            <span style={suggestionLabel}>Based on your history:</span>
            <br />
            {suggestionParts.join(" ")}
          </Text>
        )}

        <Text style={paragraph}>
          {hasSuggestion
            ? "We\u2019ve pre-filled everything based on your history \u2014 one click to confirm:"
            : "Click below to book your next fill:"}
        </Text>
        <Text style={ctaWrapper}>
          <a href={bookingUrl} style={cta}>
            {hasSuggestion ? "Confirm Your Fill →" : "Rebook Your Fill →"}
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

const suggestionBox: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#5a3e31",
  backgroundColor: "#faf6f1",
  border: "1px solid #e8c4b8",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "0 0 16px",
};

const suggestionLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "#96604a",
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
