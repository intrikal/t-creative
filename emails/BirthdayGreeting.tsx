import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type BirthdayGreetingProps = {
  clientName: string;
};

export function BirthdayGreeting({ clientName }: BirthdayGreetingProps) {
  return (
    <Layout preview={`Happy Birthday, ${clientName}!`}>
      <Section style={content}>
        <Text style={heading}>Happy Birthday!</Text>
        <Text style={paragraph}>
          Hey {clientName}, wishing you the happiest of birthdays from everyone at T Creative
          Studio!
        </Text>

        <Text style={paragraph}>
          To celebrate, we&apos;d love to treat you to something special. Reply to this email to
          claim your birthday perk — we can&apos;t wait to pamper you!
        </Text>

        <Text style={muted}>From all of us at T Creative Studio — have a wonderful day!</Text>
      </Section>
    </Layout>
  );
}

export default BirthdayGreeting;

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
