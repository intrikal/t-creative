import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type MembershipReminderProps = {
  clientName: string | null;
  planName: string;
  /** Number of fills still available this cycle. */
  fillsRemaining: number;
  /** Total fills included per cycle. */
  fillsPerCycle: number;
  /** Human-readable cycle end date, e.g. "April 1". */
  cycleEndsAt: string;
  /** Days until the cycle resets. */
  daysUntilReset: number;
  /** Link to the booking page. */
  bookingUrl: string;
};

export function MembershipReminder({
  clientName,
  planName,
  fillsRemaining,
  fillsPerCycle,
  cycleEndsAt,
  daysUntilReset,
  bookingUrl,
}: MembershipReminderProps) {
  const allFillsUsed = fillsRemaining === 0;
  const fillWord = fillsRemaining === 1 ? "fill" : "fills";

  return (
    <Layout preview={`Your ${planName} cycle resets on ${cycleEndsAt}`}>
      <Section style={content}>
        <Text style={heading}>Your Membership Cycle Is Almost Up</Text>
        <Text style={paragraph}>
          Hey {clientName ?? "there"}! Your <strong>{planName}</strong> cycle resets on{" "}
          <strong>{cycleEndsAt}</strong> ({daysUntilReset === 1 ? "tomorrow" : `in ${daysUntilReset} days`}).
        </Text>

        {!allFillsUsed && (
          <>
            <Text style={highlightBox}>
              You have <strong>{fillsRemaining}</strong> {fillWord} remaining out of{" "}
              {fillsPerCycle} this cycle. Unused fills don&apos;t roll over — book now to get
              the most out of your membership!
            </Text>
            <Text style={paragraph}>
              Don&apos;t let {fillsRemaining === 1 ? "it" : "them"} go to waste — tap below to
              book before your cycle resets:
            </Text>
          </>
        )}

        {allFillsUsed && (
          <Text style={paragraph}>
            You&apos;ve used all {fillsPerCycle} of your included fills this cycle — nice! Your
            fills will reset to {fillsPerCycle} when your new cycle begins. If you need anything
            before then, you can still book at the member rate:
          </Text>
        )}

        <Text style={ctaWrapper}>
          <a href={bookingUrl} style={cta}>
            {allFillsUsed ? "Book an Appointment →" : "Book Your Fill →"}
          </a>
        </Text>
        <Text style={muted}>
          Questions about your membership? Just reply to this email and we&apos;ll be happy to
          help.
        </Text>
      </Section>
    </Layout>
  );
}

export default MembershipReminder;

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

const highlightBox: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#5a3e31",
  backgroundColor: "#faf6f1",
  border: "1px solid #e8c4b8",
  borderRadius: "8px",
  padding: "12px 16px",
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
