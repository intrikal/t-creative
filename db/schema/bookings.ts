/**
 * bookings — Appointment scheduling and lifecycle tracking.
 *
 * Central table for the business — every lash set, jewelry welding,
 * crochet pickup, and consulting session flows through here. Bookings
 * reference both the client and (optionally) an assigned staff member,
 * enabling the assistant dashboard's calendar and today views.
 *
 * Square is the source of truth for appointment scheduling, SMS reminders,
 * and rescheduling. The `squareAppointmentId` links local bookings to
 * Square's Bookings API so webhooks can keep status in sync.
 *
 * Pricing snapshots the service price at booking time so historical
 * records remain accurate even if the service catalog changes.
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
import { bookingStatusEnum } from "./enums";
import { giftCards } from "./gift-cards";
import { payments } from "./payments";
import { promotions } from "./promotions";
import { reviews } from "./reviews";
import { services } from "./services";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Bookings                                                           */
/* ------------------------------------------------------------------ */

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),

    /** The client who booked. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /** Staff member assigned to this appointment (nullable for unassigned). */
    staffId: uuid("staff_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),

    status: bookingStatusEnum("status").notNull().default("pending"),

    /** Scheduled start time. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Expected duration in minutes (snapshotted from service at booking time). */
    durationMinutes: integer("duration_minutes").notNull(),

    /** Price in cents (snapshotted from service + add-ons at booking time). */
    totalInCents: integer("total_in_cents").notNull(),

    /* ------ Discounts / Redemptions ------ */

    /** Gift card applied to this booking (nullable). */
    giftCardId: integer("gift_card_id").references(() => giftCards.id, { onDelete: "set null" }),

    /** Promotion code applied to this booking (nullable). */
    promotionId: integer("promotion_id").references(() => promotions.id, { onDelete: "set null" }),

    /** Discount amount in cents (from gift card or promo). */
    discountInCents: integer("discount_in_cents").notNull().default(0),

    /** Client-provided notes (e.g. "prefers natural look"). */
    clientNotes: text("client_notes"),

    /** Internal notes from staff (e.g. "used 0.15mm classic"). */
    staffNotes: text("staff_notes"),

    /** Location or method — "San Jose Studio", "Mobile", "Virtual". */
    location: varchar("location", { length: 200 }),

    /* ------ External integrations ------ */

    /** Square Bookings API appointment ID. Source of truth for scheduling/SMS. */
    squareAppointmentId: varchar("square_appointment_id", { length: 100 }),

    /** Square Order ID — created at booking confirmation for POS payment matching. */
    squareOrderId: varchar("square_order_id", { length: 100 }),

    /** Zoho CRM project/deal ID for consulting engagements. */
    zohoProjectId: varchar("zoho_project_id", { length: 100 }),

    /** Zoho Books invoice ID for accounting reconciliation. */
    zohoInvoiceId: varchar("zoho_invoice_id", { length: 100 }),

    /* ------ Lifecycle timestamps ------ */

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** If cancelled, why. */
    cancellationReason: text("cancellation_reason"),

    /* ------ Deposit tracking ------ */

    /** Deposit amount collected in cents. Null = no deposit collected yet. */
    depositPaidInCents: integer("deposit_paid_in_cents"),

    /** When the deposit was collected. */
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("bookings_client_idx").on(t.clientId),
    index("bookings_staff_idx").on(t.staffId),
    index("bookings_service_idx").on(t.serviceId),
    index("bookings_status_idx").on(t.status),
    index("bookings_starts_at_idx").on(t.startsAt),
    index("bookings_square_id_idx").on(t.squareAppointmentId),
    index("bookings_square_order_idx").on(t.squareOrderId),
    index("bookings_gift_card_idx").on(t.giftCardId),
    index("bookings_promotion_idx").on(t.promotionId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Booking Add-ons (junction table)                                   */
/* ------------------------------------------------------------------ */

/**
 * Records which add-ons were selected for a given booking, with
 * snapshotted pricing for historical accuracy.
 */
export const bookingAddOns = pgTable(
  "booking_add_ons",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    addOnName: varchar("add_on_name", { length: 200 }).notNull(),
    priceInCents: integer("price_in_cents").notNull(),
  },
  (t) => [index("booking_add_ons_booking_idx").on(t.bookingId)],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  /** Many-to-one: bookings.client_id → profiles.id (the client who booked). */
  client: one(profiles, {
    fields: [bookings.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: bookings.staff_id → profiles.id (assigned staff member, nullable). */
  staff: one(profiles, {
    fields: [bookings.staffId],
    references: [profiles.id],
    relationName: "assignedStaff",
  }),
  /** Many-to-one: bookings.service_id → services.id (the service being performed). */
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  /** One-to-many: bookings.id → booking_add_ons.booking_id (selected extras with snapshotted prices). */
  addOns: many(bookingAddOns),
  /** One-to-many: bookings.id → payments.booking_id (payment records for this appointment). */
  payments: many(payments),
  /** One-to-many: bookings.id → reviews.booking_id (client reviews for this appointment). */
  review: many(reviews),
  /** Many-to-one: bookings.gift_card_id → gift_cards.id (gift card applied). */
  giftCard: one(giftCards, {
    fields: [bookings.giftCardId],
    references: [giftCards.id],
  }),
  /** Many-to-one: bookings.promotion_id → promotions.id (promo code applied). */
  promotion: one(promotions, {
    fields: [bookings.promotionId],
    references: [promotions.id],
  }),
}));

export const bookingAddOnsRelations = relations(bookingAddOns, ({ one }) => ({
  /** Many-to-one: booking_add_ons.booking_id → bookings.id (parent booking). */
  booking: one(bookings, {
    fields: [bookingAddOns.bookingId],
    references: [bookings.id],
  }),
}));
