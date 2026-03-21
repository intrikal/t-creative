import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";

export type OrderShippedProps = {
  clientName: string;
  orderNumber: string;
  productTitle: string;
  trackingNumber: string;
  trackingUrl: string;
  businessName?: string;
};

export function OrderShipped({
  clientName,
  orderNumber,
  productTitle,
  trackingNumber,
  trackingUrl,
  businessName = "T Creative Studio",
}: OrderShippedProps) {
  return (
    <Layout preview={`Order ${orderNumber} has shipped`} businessName={businessName}>
      <Section style={content}>
        <Text style={heading}>Your Order Has Shipped!</Text>
        <Text style={paragraph}>
          Hey {clientName}, your order <strong>{orderNumber}</strong> is on its way!
        </Text>

        <Text style={detailLabel}>Item</Text>
        <Text style={detailValue}>{productTitle}</Text>

        <Text style={detailLabel}>Tracking Number</Text>
        <Text style={detailValue}>{trackingNumber}</Text>

        {trackingUrl && <Button href={trackingUrl}>Track Your Package</Button>}

        <Text style={muted}>
          You&apos;ll receive another update when your package is delivered.
        </Text>
      </Section>
    </Layout>
  );
}

export default OrderShipped;

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

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "20px 0 0",
};
