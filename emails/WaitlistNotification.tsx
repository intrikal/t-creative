import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type WaitlistNotificationProps = {
  clientName: string;
  serviceName: string;
  /** Direct link to the claim page. When provided a button is shown. */
  bookingLink?: string;
  /** Human-readable slot date/time, e.g. "Saturday, April 5 at 2:00 PM". */
  slotDate?: string;
};

export function WaitlistNotification({
  clientName,
  serviceName,
  bookingLink,
  slotDate,
}: WaitlistNotificationProps) {
  return (
    <Layout preview={`A spot opened up for ${serviceName}!`}>
      <Section style={content}>
        <Text style={heading}>A Spot Opened Up!</Text>
        <Text style={paragraph}>
          Hey {clientName}, great news — a spot just opened up for <strong>{serviceName}</strong>!
        </Text>

        {slotDate && <Text style={slotBox}>📅 {slotDate}</Text>}

        {bookingLink ? (
          <>
            <Text style={paragraph}>
              Since you were on the waitlist, you get first dibs. Click below to claim the slot —
              this offer expires in <strong>24 hours</strong>.
            </Text>
            <Section style={buttonWrapper}>
              <Button href={bookingLink}>Claim This Slot</Button>
            </Section>
            <Text style={muted}>
              If the button doesn&apos;t work, copy this link into your browser:{" "}
              <span style={{ wordBreak: "break-all" }}>{bookingLink}</span>
            </Text>
          </>
        ) : (
          <Text style={paragraph}>
            Since you were on the waitlist, you get first dibs. Reply to this email or contact us to
            book your appointment before the spot fills up.
          </Text>
        )}

        <Text style={muted}>
          No longer interested? No worries — just ignore this email and we&apos;ll remove you from
          the waitlist.
        </Text>
      </Section>
    </Layout>
  );
}

export default WaitlistNotification;

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

const slotBox: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#1a1a1a",
  backgroundColor: "#f5f5f5",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 20px",
};

const buttonWrapper: React.CSSProperties = {
  margin: "0 0 20px",
};

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
