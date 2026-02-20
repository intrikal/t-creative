/**
 * product-inquiries — Marketplace product inquiry flow.
 *
 * Separate from general contact inquiries (`inquiries` table). These are
 * product-specific — a client is asking about a particular item, often
 * with customization requests. The lifecycle:
 *
 *   New → Contacted → Quote Sent → In Progress → Completed
 *
 * "Completed" means the inquiry converted to an order. The conversion
 * rate metric (Inquiry → Order) on the Analytics tab is calculated from
 * the ratio of completed inquiries to total inquiries.
 *
 * Product inquiries that convert create a row in the `orders` table
 * with a back-reference via `orders.inquiryId`.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { products } from "./products";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Product inquiry pipeline stages — shown in the Inquiry Status Breakdown. */
export const productInquiryStatusEnum = pgEnum("product_inquiry_status", [
  "new",
  "contacted",
  "quote_sent",
  "in_progress",
  "completed",
]);

/* ------------------------------------------------------------------ */
/*  Product Inquiries                                                  */
/* ------------------------------------------------------------------ */

export const productInquiries = pgTable(
  "product_inquiries",
  {
    id: serial("id").primaryKey(),

    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),

    /** Nullable — anonymous visitors can inquire without an account. */
    clientId: uuid("client_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    status: productInquiryStatusEnum("status").notNull().default("new"),

    /** Contact info (may differ from profile if anonymous). */
    clientName: varchar("client_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 30 }),

    /** Requested quantity. */
    quantity: integer("quantity").notNull().default(1),

    /** What the client is asking / describing. */
    message: text("message"),

    /** Specific customization requests (e.g. "Pink and white colors"). */
    customizations: text("customizations"),

    /** Quoted price in cents (set when status moves to "quote_sent"). */
    quotedInCents: integer("quoted_in_cents"),

    /** Staff notes for internal tracking. */
    internalNotes: text("internal_notes"),

    /** When staff first reached out. */
    contactedAt: timestamp("contacted_at", { withTimezone: true }),

    /** When quote was sent. */
    quoteSentAt: timestamp("quote_sent_at", { withTimezone: true }),

    /** The resulting order ID if this inquiry converted. */
    convertedOrderId: integer("converted_order_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("product_inquiries_product_idx").on(t.productId),
    index("product_inquiries_client_idx").on(t.clientId),
    index("product_inquiries_status_idx").on(t.status),
    index("product_inquiries_email_idx").on(t.email),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const productInquiriesRelations = relations(productInquiries, ({ one }) => ({
  /** Many-to-one: many inquiries reference one product (product_inquiries.product_id → products.id). */
  product: one(products, {
    fields: [productInquiries.productId],
    references: [products.id],
  }),
  /** Many-to-one: many inquiries belong to one client (product_inquiries.client_id → profiles.id, nullable). */
  client: one(profiles, {
    fields: [productInquiries.clientId],
    references: [profiles.id],
  }),
}));
