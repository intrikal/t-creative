/**
 * lib/test-utils.ts
 * Factory functions for creating typed mock objects in tests.
 * Each factory returns sensible defaults that can be selectively overridden.
 *
 * Usage:
 *   import { createMockBooking, createMockClient, createMockPayment, createMockService } from "@/lib/test-utils";
 *
 *   const booking = createMockBooking({ status: "pending" });
 *   const client  = createMockClient({ isVip: true });
 */

import type { BookingRow } from "@/lib/types/booking.types";
import type { ClientRow } from "@/lib/types/client.types";

/* ------------------------------------------------------------------ */
/*  Local row types (mirror DB schema without importing drizzle)       */
/* ------------------------------------------------------------------ */

/**
 * Mirrors `typeof payments.$inferSelect` (db/schema/payments.ts).
 * Defined inline so test-utils has no runtime dependency on drizzle or pg.
 */
export type MockPaymentRow = {
  id: number;
  bookingId: number;
  clientId: string;
  status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  method:
    | "cash"
    | "square_card"
    | "square_cash"
    | "square_wallet"
    | "square_gift_card"
    | "square_other"
    | null;
  amountInCents: number;
  tipInCents: number;
  refundedInCents: number;
  taxAmountInCents: number;
  squarePaymentId: string | null;
  squareOrderId: string | null;
  squareInvoiceId: string | null;
  squareReceiptUrl: string | null;
  squareRefundId: string | null;
  notes: string | null;
  needsManualReview: boolean;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Mirrors `typeof services.$inferSelect` (db/schema/services.ts).
 * Defined inline so test-utils has no runtime dependency on drizzle or pg.
 */
export type MockServiceRow = {
  id: number;
  category: "lash" | "jewelry" | "crochet" | "consulting";
  name: string;
  description: string | null;
  priceInCents: number | null;
  priceMinInCents: number | null;
  priceMaxInCents: number | null;
  depositInCents: number | null;
  durationMinutes: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

/** Returns a `BookingRow` with sensible defaults. */
export function createMockBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 1,
    status: "confirmed",
    startsAt: new Date("2026-04-01T10:00:00Z"),
    durationMinutes: 60,
    totalInCents: 10000,
    location: "Studio",
    clientNotes: null,
    clientId: "client-1",
    clientFirstName: "Jane",
    clientLastName: "Doe",
    clientPhone: null,
    serviceId: 1,
    serviceName: "Classic Full Set",
    serviceCategory: "lash",
    staffId: null,
    staffFirstName: null,
    recurrenceRule: null,
    parentBookingId: null,
    recurrenceGroupId: null,
    tosAcceptedAt: null,
    tosVersion: null,
    locationId: null,
    services: [],
    ...overrides,
  };
}

/** Returns a `ClientRow` with sensible defaults. */
export function createMockClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "client-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: null,
    source: "instagram",
    isVip: false,
    lifecycleStage: "active",
    internalNotes: null,
    tags: null,
    referredByName: null,
    referralCount: 0,
    createdAt: new Date("2026-01-01"),
    totalBookings: 0,
    totalSpent: 0,
    lastVisit: null,
    loyaltyPoints: 0,
    ...overrides,
  };
}

/** Returns a `MockPaymentRow` with sensible defaults. */
export function createMockPayment(overrides: Partial<MockPaymentRow> = {}): MockPaymentRow {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: 1,
    bookingId: 1,
    clientId: "client-1",
    status: "paid",
    method: "cash",
    amountInCents: 10000,
    tipInCents: 0,
    refundedInCents: 0,
    taxAmountInCents: 0,
    squarePaymentId: null,
    squareOrderId: null,
    squareInvoiceId: null,
    squareReceiptUrl: null,
    squareRefundId: null,
    notes: null,
    needsManualReview: false,
    paidAt: now,
    refundedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Returns a `MockServiceRow` with sensible defaults. */
export function createMockService(overrides: Partial<MockServiceRow> = {}): MockServiceRow {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: 1,
    category: "lash",
    name: "Classic Full Set",
    description: null,
    priceInCents: 12000,
    priceMinInCents: null,
    priceMaxInCents: null,
    depositInCents: null,
    durationMinutes: 90,
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
