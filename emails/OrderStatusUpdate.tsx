import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Layout } from "./components/Layout";

export type OrderStatusUpdateProps = {
  clientName: string;
  orderNumber: string;
  productTitle: string;
  status: "ready_for_pickup" | "completed";
};

const statusConfig = {
  ready_for_pickup: {
    heading: "Your Order is Ready for Pickup",
    message: "Your order is ready! Come pick it up at the studio at your earliest convenience.",
  },
  completed: {
    heading: "Order Complete",
    message: "Your order has been completed. Thank you for your business!",
  },
};

export function OrderStatusUpdate({
  clientName,
  orderNumber,
  productTitle,
  status,
}: OrderStatusUpdateProps) {
  const config = statusConfig[status];

  return (
    <Layout preview={`Order ${orderNumber} — ${config.heading}`}>
      <Section style={content}>
        <Text style={heading}>{config.heading}</Text>
        <Text style={paragraph}>
          Hey {clientName}, {config.message}
        </Text>

        <Text style={detailLabel}>Order</Text>
        <Text style={detailValue}>{orderNumber}</Text>

        <Text style={detailLabel}>Item</Text>
        <Text style={detailValue}>{productTitle}</Text>

        <Text style={muted}>Questions? Reply to this email or contact us directly.</Text>
      </Section>
    </Layout>
  );
}

export default OrderStatusUpdate;

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
