import * as React from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

type LayoutProps = {
  preview: string;
  children: React.ReactNode;
};

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>T Creative Studio</Text>
          </Section>
          {children}
          <Hr style={hr} />
          <Text style={footer}>T Creative Studio &middot; Beauty, Jewelry & Crochet</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "560px",
  borderRadius: "8px",
};

const header: React.CSSProperties = {
  padding: "20px 40px 0",
};

const logo: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "0 0 20px",
};

const hr: React.CSSProperties = {
  borderColor: "#e6e6e6",
  margin: "32px 40px",
};

const footer: React.CSSProperties = {
  color: "#999999",
  fontSize: "12px",
  padding: "0 40px",
};
