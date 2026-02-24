/**
 * invoices — Client invoices for services rendered.
 *
 * Tracks the full invoice lifecycle from draft through payment.
 * Invoice numbers are auto-generated (INV-001, INV-002, …) at creation.
 *
 * All monetary values are stored in cents to avoid floating-point errors.
 */
import { relations } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { invoiceStatusEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Invoices                                                           */
/* ------------------------------------------------------------------ */

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),

    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /** Auto-generated invoice number, e.g. "INV-001". */
    number: varchar("number", { length: 20 }).notNull(),

    /** Line-item description or service summary. */
    description: text("description").notNull(),

    /** Invoice total in cents. */
    amountInCents: integer("amount_in_cents").notNull(),

    status: invoiceStatusEnum("status").notNull().default("draft"),

    /** When the invoice was sent to the client. */
    issuedAt: timestamp("issued_at", { withTimezone: true }),

    /** Payment due date. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** When the client paid. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    notes: text("notes"),

    /* ------ Recurring ------ */

    /** Whether this invoice recurs on a schedule. */
    isRecurring: boolean("is_recurring").notNull().default(false),

    /** Recurrence interval: "weekly", "monthly", "quarterly". */
    recurrenceInterval: varchar("recurrence_interval", { length: 20 }),

    /** Next scheduled due date for recurring invoices. */
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),

    /** Parent invoice ID (for auto-generated recurring copies). */
    parentInvoiceId: integer("parent_invoice_id").references((): AnyPgColumn => invoices.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("invoices_number_idx").on(t.number),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_status_idx").on(t.status),
    index("invoices_recurring_idx").on(t.isRecurring),
    index("invoices_next_due_idx").on(t.nextDueAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const invoicesRelations = relations(invoices, ({ one }) => ({
  /** Many-to-one: many invoices belong to one client (invoices.client_id → profiles.id). */
  client: one(profiles, {
    fields: [invoices.clientId],
    references: [profiles.id],
  }),
}));
