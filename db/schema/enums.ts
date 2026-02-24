/**
 * enums — Postgres enum types shared across the schema.
 *
 * Defined as native PG enums via `pgEnum` so they live in the database
 * as first-class types rather than check constraints. This gives better
 * introspection in Supabase Studio and tighter storage than varchar checks.
 */
import { pgEnum } from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  RBAC                                                               */
/* ------------------------------------------------------------------ */

/**
 * User roles for role-based access control.
 *
 * - `admin`     — Full platform access. Trini and any future co-owners.
 * - `assistant` — Staff-level access to bookings, clients, and ops views.
 *                 Cannot modify business settings or financials.
 * - `client`    — End-user access to their own bookings, messages,
 *                 orders, payments, and reviews.
 */
export const userRoleEnum = pgEnum("user_role", ["admin", "assistant", "client"]);

/* ------------------------------------------------------------------ */
/*  Booking / Appointment lifecycle                                    */
/* ------------------------------------------------------------------ */

/** Tracks a booking from request through completion or cancellation. */
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

/* ------------------------------------------------------------------ */
/*  Payments                                                           */
/* ------------------------------------------------------------------ */

/** Payment lifecycle from invoice to settlement or failure. */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

/**
 * Square tender types — maps to Square's payment instrument categories.
 * Square processes all transactions; this tracks which tender the client used.
 *
 * @see https://developer.squareup.com/reference/square/objects/Tender
 */
export const paymentMethodEnum = pgEnum("payment_method", [
  "square_card",
  "square_cash",
  "square_wallet",
  "square_gift_card",
  "square_other",
]);

/* ------------------------------------------------------------------ */
/*  Services                                                           */
/* ------------------------------------------------------------------ */

/** Business zones — mirrors lib/zones.ts for DB-level categorization. */
export const serviceCategoryEnum = pgEnum("service_category", [
  "lash",
  "jewelry",
  "crochet",
  "consulting",
]);

/* ------------------------------------------------------------------ */
/*  Orders & Inquiries                                                 */
/* ------------------------------------------------------------------ */

/** Custom order / product order lifecycle. */
export const orderStatusEnum = pgEnum("order_status", [
  "inquiry",
  "quoted",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
]);

/** Contact form and general inquiry status. */
export const inquiryStatusEnum = pgEnum("inquiry_status", ["new", "read", "replied", "archived"]);

/* ------------------------------------------------------------------ */
/*  Messages                                                           */
/* ------------------------------------------------------------------ */

/** Message channel type for the inbox system. */
export const messageChannelEnum = pgEnum("message_channel", ["internal", "email", "sms"]);

/* ------------------------------------------------------------------ */
/*  Media                                                              */
/* ------------------------------------------------------------------ */

/** Supported media asset types for the portfolio and gallery. */
export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "before_after"]);

/* ------------------------------------------------------------------ */
/*  Forms & Waivers                                                    */
/* ------------------------------------------------------------------ */

/** Client form types for intake, consent, and liability flows. */
export const formTypeEnum = pgEnum("form_type", ["intake", "waiver", "consent", "custom"]);
