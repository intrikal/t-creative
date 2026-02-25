/**
 * orders — Marketplace orders and custom commissions.
 *
 * Handles two flows from the Marketplace dashboard:
 * 1. **Product orders** — Purchases of items from the product catalog
 *    (ready-made or custom order). Links to a specific product.
 * 2. **Custom commissions** — Freeform requests not tied to a catalog
 *    product (e.g. "I want a queen-size blanket in sage and ivory").
 *
 * The "Orders" tab in the Marketplace view shows all orders.
 * The "Inquiries" tab shows orders with status "inquiry".
 * Revenue and conversion metrics aggregate from completed orders.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { orderStatusEnum, serviceCategoryEnum } from "./enums";
import { products } from "./products";
import { services } from "./services";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Orders                                                             */
/* ------------------------------------------------------------------ */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),

    /** Display order number (e.g. "ord-123"). Auto-formatted in app layer. */
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),

    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /** Link to the product catalog. Null for freeform custom commissions. */
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),

    /**
     * Back-reference to the product inquiry that converted into this order.
     * Set when a `productInquiries` row reaches "completed" status and an
     * order is created. The inquiry's `convertedOrderId` points back here.
     * Not a FK constraint to avoid circular dependency — validated in app layer.
     */
    inquiryId: integer("inquiry_id"),

    status: orderStatusEnum("status").notNull().default("inquiry"),

    /** Which service zone this order falls under (for non-product orders). */
    category: serviceCategoryEnum("category"),

    /** Short label (e.g. "Custom baby blanket", "Bulk charm bracelets"). */
    title: varchar("title", { length: 300 }).notNull(),

    /** Detailed description of what the client wants. */
    description: text("description"),

    /** Quantity ordered (defaults to 1). */
    quantity: integer("quantity").notNull().default(1),

    /** Quoted price in cents (null until quoted). */
    quotedInCents: integer("quoted_in_cents"),

    /** Final agreed price in cents. */
    finalInCents: integer("final_in_cents"),

    /**
     * Flexible metadata for order-specific details.
     * E.g. `{ "colors": ["sage", "ivory"], "size": "queen", "deadline": "2026-04-01" }`
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /**
     * How the client chose to pay/receive:
     * - "pickup_online" — pay now via Square, pick up at studio
     * - "pickup_cash" — pick up at studio, pay cash
     */
    fulfillmentMethod: varchar("fulfillment_method", { length: 50 }),

    /** Link to service for dual-listed items (training/consulting packages). */
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "set null",
    }),

    /** Square order/payment ID for paid orders. */
    squareOrderId: varchar("square_order_id", { length: 100 }),

    /** Staff-facing notes. */
    internalNotes: text("internal_notes"),

    /**
     * Estimated completion date shown on the order card.
     * Set by Trini when quoting — updated as the order progresses.
     * Displayed as "Est. completion: Apr 1" on the order detail view.
     */
    estimatedCompletionAt: timestamp("estimated_completion_at", {
      withTimezone: true,
    }),

    /** When the order was marked complete and delivered to the client. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** When the order was cancelled. Null if still active. */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_client_idx").on(t.clientId),
    index("orders_product_idx").on(t.productId),
    index("orders_status_idx").on(t.status),
    index("orders_category_idx").on(t.category),
    index("orders_square_idx").on(t.squareOrderId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const ordersRelations = relations(orders, ({ one }) => ({
  /** Many-to-one: many orders belong to one client (orders.client_id → profiles.id). */
  client: one(profiles, {
    fields: [orders.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: many orders can reference one product (orders.product_id → products.id, nullable). */
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));
