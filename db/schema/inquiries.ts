/**
 * inquiries — Contact form submissions and general inquiries.
 *
 * Captures submissions from the public contact form (/contact) and any
 * other lead-gen entry points. Unlike bookings or orders, inquiries are
 * unstructured — the client hasn't committed to a specific service yet.
 *
 * **Distinct from `productInquiries`** — those are product-specific asks
 * from the marketplace (tied to a specific product with customization
 * requests). This table is for general "I'm interested in lash services"
 * or "Tell me about your crochet work" type messages.
 *
 * Feeds the admin Messages inbox (type = "inquiry") and the client
 * portal's "Inquiries" view.
 */
import { relations } from "drizzle-orm";
import { index, pgTable, serial, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { inquiryStatusEnum, serviceCategoryEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Inquiries                                                          */
/* ------------------------------------------------------------------ */

export const inquiries = pgTable(
  "inquiries",
  {
    id: serial("id").primaryKey(),

    /** Nullable — anonymous visitors won't have an account yet. */
    clientId: uuid("client_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /** Inquiry lifecycle: new → read → replied → archived. */
    status: inquiryStatusEnum("status").notNull().default("new"),

    /**
     * Which service zone the visitor is interested in (optional).
     * Maps to the 4 business zones (lash/jewelry/crochet/consulting).
     * Used to route inquiries to the right staff and for analytics
     * on which services generate the most inbound interest.
     */
    interest: serviceCategoryEnum("interest"),

    /** Contact info for anonymous submissions. */
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 30 }),

    /** The inquiry message. */
    message: text("message").notNull(),

    /**
     * Staff response text — sent back to the client via email and shown
     * in the admin inbox detail panel. Plain text (no markdown).
     * When set, status should move to "replied".
     */
    staffReply: text("staff_reply"),

    /** When staff sent the reply. Null if not yet responded. */
    repliedAt: timestamp("replied_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("inquiries_client_idx").on(t.clientId),
    index("inquiries_status_idx").on(t.status),
    index("inquiries_email_idx").on(t.email),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  /** Many-to-one: many inquiries belong to one client (inquiries.client_id → profiles.id, nullable for anonymous). */
  client: one(profiles, {
    fields: [inquiries.clientId],
    references: [profiles.id],
  }),
}));
