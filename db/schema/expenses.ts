/**
 * expenses — Business expense tracking for bookkeeping.
 *
 * Records operational costs (supplies, rent, marketing, etc.) logged by
 * admin users. Used by the financial dashboard for spend breakdowns.
 *
 * All monetary values are stored in cents to avoid floating-point errors.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { expenseCategoryEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Expenses                                                           */
/* ------------------------------------------------------------------ */

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),

    /** Date the expense was incurred. */
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),

    category: expenseCategoryEnum("category").notNull(),

    /** What was purchased or paid for. */
    description: text("description").notNull(),

    /** Vendor or payee name. */
    vendor: varchar("vendor", { length: 150 }),

    /** Expense amount in cents. */
    amountInCents: integer("amount_in_cents").notNull(),

    /** Whether a receipt has been uploaded / is on file. */
    hasReceipt: boolean("has_receipt").notNull().default(false),

    /** Admin who logged this expense. */
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("expenses_category_idx").on(t.category),
    index("expenses_created_by_idx").on(t.createdBy),
    index("expenses_date_idx").on(t.expenseDate),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const expensesRelations = relations(expenses, ({ one }) => ({
  /** Many-to-one: expense logged by one admin (expenses.created_by → profiles.id). */
  creator: one(profiles, {
    fields: [expenses.createdBy],
    references: [profiles.id],
  }),
}));
