import * as React from "react";
import { Section, Text } from "@react-email/components";
import { Button } from "./components/Button";
import { Layout } from "./components/Layout";
import { PriceTable } from "./components/PriceTable";

export type OrderConfirmationProps = {
  clientName: string;
  orderNumber: string;
  items: { name: string; quantity: number; amountInCents: number }[];
  totalInCents: number;
  fulfillmentMethod: "pickup_cash" | "pickup_online";
  paymentUrl?: string;
};

export function OrderConfirmation({
  clientName,
  orderNumber,
  items,
  totalInCents,
  fulfillmentMethod,
  paymentUrl,
}: OrderConfirmationProps) {
  return (
    <Layout preview={`Order ${orderNumber} confirmed`}>
      <Section style={content}>
        <Text style={heading}>Order Confirmed</Text>
        <Text style={paragraph}>
          Hey {clientName}, your order <strong>{orderNumber}</strong> has been placed!
        </Text>
      </Section>

      <PriceTable items={items} totalInCents={totalInCents} />

      <Section style={content}>
        {fulfillmentMethod === "pickup_online" && paymentUrl ? (
          <>
            <Text style={paragraph}>Complete your payment to finalize this order:</Text>
            <Button href={paymentUrl}>Pay Now</Button>
          </>
        ) : (
          <Text style={paragraph}>
            Please bring cash when you pick up your order at the studio.
          </Text>
        )}

        <Text style={muted}>We&apos;ll let you know when your order is ready for pickup.</Text>
      </Section>
    </Layout>
  );
}

export default OrderConfirmation;

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

const muted: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: "16px 0 0",
};
