/**
 * payments — Payment tracking synced with Square.
 *
 * Square is the payment processor — handles card transactions, invoicing,
 * receipts, and refunds. This table mirrors Square payment records locally
 * for the financial dashboard, analytics, and offline reporting.
 *
 * Square webhook events (payment.completed, refund.created, etc.) update
 * these records via an API route handler.
 *
 * All monetary values are stored in cents to avoid floating-point errors.
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
import { bookings } from "./bookings";
import { paymentMethodEnum, paymentStatusEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Payments                                                           */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),

    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),

    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    status: paymentStatusEnum("status").notNull().default("pending"),
    method: paymentMethodEnum("method"),

    /** Amount charged in cents (excludes tip). */
    amountInCents: integer("amount_in_cents").notNull(),

    /** Tip in cents. */
    tipInCents: integer("tip_in_cents").notNull().default(0),

    /** Amount refunded in cents (for partial or full refunds). */
    refundedInCents: integer("refunded_in_cents").notNull().default(0),

    /* ------ Square integration ------ */

    /** Square payment ID — source of truth for transaction state. */
    squarePaymentId: varchar("square_payment_id", { length: 100 }),

    /** Square order ID (groups line items for a single transaction). */
    squareOrderId: varchar("square_order_id", { length: 100 }),

    /** Square invoice ID (for pre-appointment invoicing). */
    squareInvoiceId: varchar("square_invoice_id", { length: 100 }),

    /** Square receipt URL — sent to client post-payment. */
    squareReceiptUrl: text("square_receipt_url"),

    /** Staff or system notes on this payment. */
    notes: text("notes"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    index("payments_client_idx").on(t.clientId),
    index("payments_status_idx").on(t.status),
    index("payments_paid_at_idx").on(t.paidAt),
    index("payments_square_id_idx").on(t.squarePaymentId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const paymentsRelations = relations(payments, ({ one }) => ({
  /** Many-to-one: many payments belong to one booking (payments.booking_id → bookings.id). */
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
  /** Many-to-one: many payments belong to one client (payments.client_id → profiles.id). */
  client: one(profiles, {
    fields: [payments.clientId],
    references: [profiles.id],
  }),
}));
