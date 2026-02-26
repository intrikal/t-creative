import * as React from "react";
import { Section, Row, Column, Text, Hr } from "@react-email/components";
import { formatCents } from "./format";

type LineItem = {
  name: string;
  quantity: number;
  amountInCents: number;
};

type PriceTableProps = {
  items: LineItem[];
  totalInCents: number;
};

export function PriceTable({ items, totalInCents }: PriceTableProps) {
  return (
    <Section style={section}>
      {items.map((item, i) => (
        <Row key={i} style={row}>
          <Column style={nameCol}>
            <Text style={itemText}>
              {item.name} {item.quantity > 1 ? `x${item.quantity}` : ""}
            </Text>
          </Column>
          <Column style={priceCol}>
            <Text style={priceText}>{formatCents(item.amountInCents)}</Text>
          </Column>
        </Row>
      ))}
      <Hr style={divider} />
      <Row style={row}>
        <Column style={nameCol}>
          <Text style={totalLabel}>Total</Text>
        </Column>
        <Column style={priceCol}>
          <Text style={totalValue}>{formatCents(totalInCents)}</Text>
        </Column>
      </Row>
    </Section>
  );
}

const section: React.CSSProperties = {
  padding: "0 40px",
};

const row: React.CSSProperties = {
  marginBottom: "4px",
};

const nameCol: React.CSSProperties = {
  width: "70%",
};

const priceCol: React.CSSProperties = {
  width: "30%",
  textAlign: "right" as const,
};

const itemText: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "4px 0",
};

const priceText: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "4px 0",
  textAlign: "right" as const,
};

const divider: React.CSSProperties = {
  borderColor: "#e6e6e6",
  margin: "8px 0",
};

const totalLabel: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "4px 0",
};

const totalValue: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#1a1a1a",
  margin: "4px 0",
  textAlign: "right" as const,
};
