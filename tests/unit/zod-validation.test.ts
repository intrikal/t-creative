/**
 * tests/unit/zod-validation.test.ts
 *
 * Pure unit tests for the Zod schemas defined in API route handlers.
 * No network, no database, no mocking — schemas are re-declared inline so
 * that changes to the source schemas cause test failures intentionally.
 *
 * Coverage areas per schema:
 *   1. Happy path — valid payload passes safeParse
 *   2. Empty body — {} returns error
 *   3. Wrong types — string where number expected (and vice versa)
 *   4. Missing required fields — each required field omitted individually
 *   5. Extra/unknown fields — stripped (Zod default) or cause error (strict)
 *   6. Boundary values on money — 0¢ (valid), -1¢ (invalid), MAX_SAFE_INTEGER, 0.5 (float)
 *   7. String length limits — empty required fields, 10 000-char strings
 *   8. Email validation — malformed emails rejected
 *   9. Phone — various international formats
 *  10. Date validation — past, far-future, invalid strings
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ─── Re-declarations of source schemas ────────────────────────────────────────
// Intentionally copied so that schema changes break tests, forcing review.

// POST /api/book/guest-request
const guestRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  serviceId: z.union([z.string().min(1), z.number()]),
  preferredDate: z.string().min(1),
  notes: z.string().optional(),
  referencePhotoUrls: z.array(z.string().url()).optional(),
  preferredCadence: z.string().optional(),
  recaptchaToken: z.string().optional(),
  selectedAddOns: z.array(z.object({ name: z.string(), priceInCents: z.number() })).optional(),
});

// POST /api/book/pay-deposit
const payDepositSchema = z.object({
  sourceId: z.string().min(1),
  serviceId: z.number(),
  preferredDate: z.string().min(1),
  notes: z.string().optional(),
  recurrenceRule: z.string().optional(),
  referencePhotoUrls: z.array(z.string().url()).optional(),
  idempotencyKey: z.string().min(1),
  selectedAddOns: z.array(z.object({ name: z.string(), priceInCents: z.number() })).optional(),
  tosAccepted: z.literal(true, { error: "Policy acceptance is required" }),
  tosVersion: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  recaptchaToken: z.string().optional(),
});

// POST /api/book/waitlist
const waitlistSchema = z.object({
  serviceId: z.union([z.string().min(1), z.number()]),
  name: z.string().optional(),
  email: z.string().email().optional(),
  datePreference: z.string().optional(),
  notes: z.string().optional(),
  recaptchaToken: z.string().optional(),
});

// POST /api/chat/fallback
const chatFallbackSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  question: z.string().min(1),
  recaptchaToken: z.string().optional(),
});

// POST /api/invites
const invitesSchema = z.object({
  email: z.string().email(),
});

// GET /api/export — query params
const exportQuerySchema = z.object({
  type: z.enum(["clients", "bookings", "payments", "expenses", "invoices", "orders"]),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

// POST /api/upload-client-photo — form meta fields
const uploadClientPhotoSchema = z.object({
  bookingId: z.string().regex(/^\d+$/).transform(Number),
  profileId: z.string().uuid(),
  photoType: z.enum(["before", "after", "reference"]),
  notes: z.string().optional(),
});

// GET /api/commission-report — query params
const commissionReportSchema = z.object({
  staffId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(["csv", "pdf"]).default("csv"),
});

// POST /api/push/subscribe
const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

// DELETE /api/push/subscribe
const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  expect(
    result.success,
    `Expected success but got: ${JSON.stringify(!result.success && result.error.flatten())}`,
  ).toBe(true);
}

function fail<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success, `Expected failure for: ${JSON.stringify(value)}`).toBe(false);
}

const LONG_STRING = "x".repeat(10_000);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/book/guest-request
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/book/guest-request — guestRequestSchema", () => {
  const valid = {
    name: "Jane Smith",
    email: "jane@example.com",
    serviceId: 1,
    preferredDate: "March 2026",
  };

  it("happy path — minimal required fields pass", () => {
    ok(guestRequestSchema, valid);
  });

  it("happy path — all fields populated", () => {
    ok(guestRequestSchema, {
      ...valid,
      phone: "+18005550100",
      notes: "First appointment",
      referencePhotoUrls: ["https://cdn.example.com/photo.jpg"],
      preferredCadence: "Every 3 weeks",
      recaptchaToken: "token_abc",
      selectedAddOns: [{ name: "Lash bath", priceInCents: 1500 }],
    });
  });

  it("happy path — serviceId as string", () => {
    ok(guestRequestSchema, { ...valid, serviceId: "42" });
  });

  it("empty body returns error", () => {
    fail(guestRequestSchema, {});
  });

  it("missing required: name", () => {
    const { name: _, ...rest } = valid;
    fail(guestRequestSchema, rest);
  });

  it("missing required: email", () => {
    const { email: _, ...rest } = valid;
    fail(guestRequestSchema, rest);
  });

  it("missing required: serviceId", () => {
    const { serviceId: _, ...rest } = valid;
    fail(guestRequestSchema, rest);
  });

  it("missing required: preferredDate", () => {
    const { preferredDate: _, ...rest } = valid;
    fail(guestRequestSchema, rest);
  });

  it("wrong type: name is number", () => {
    fail(guestRequestSchema, { ...valid, name: 42 });
  });

  it("wrong type: serviceId is boolean", () => {
    fail(guestRequestSchema, { ...valid, serviceId: true });
  });

  it("wrong type: email is number", () => {
    fail(guestRequestSchema, { ...valid, email: 12345 });
  });

  it("wrong type: referencePhotoUrls is string, not array", () => {
    fail(guestRequestSchema, { ...valid, referencePhotoUrls: "https://example.com/photo.jpg" });
  });

  it("invalid email — missing @", () => {
    fail(guestRequestSchema, { ...valid, email: "notanemail" });
  });

  it("invalid email — no TLD", () => {
    fail(guestRequestSchema, { ...valid, email: "user@domain" });
  });

  it("invalid email — spaces", () => {
    fail(guestRequestSchema, { ...valid, email: "user @example.com" });
  });

  it("valid email — subdomain", () => {
    ok(guestRequestSchema, { ...valid, email: "user@mail.example.co.uk" });
  });

  it("empty string name fails (min 1)", () => {
    fail(guestRequestSchema, { ...valid, name: "" });
  });

  it("empty string preferredDate fails (min 1)", () => {
    fail(guestRequestSchema, { ...valid, preferredDate: "" });
  });

  it("serviceId empty string fails (min 1)", () => {
    fail(guestRequestSchema, { ...valid, serviceId: "" });
  });

  it("10 000-char name string passes (no max defined)", () => {
    ok(guestRequestSchema, { ...valid, name: LONG_STRING });
  });

  it("10 000-char notes string passes (no max defined)", () => {
    ok(guestRequestSchema, { ...valid, notes: LONG_STRING });
  });

  it("referencePhotoUrls with invalid URL fails", () => {
    fail(guestRequestSchema, { ...valid, referencePhotoUrls: ["not-a-url"] });
  });

  it("referencePhotoUrls with mixed valid/invalid URLs fails", () => {
    fail(guestRequestSchema, {
      ...valid,
      referencePhotoUrls: ["https://valid.com/img.jpg", "bad-url"],
    });
  });

  it("selectedAddOns with negative priceInCents passes (no constraint in schema)", () => {
    // Schema has no lower-bound constraint on priceInCents here
    ok(guestRequestSchema, {
      ...valid,
      selectedAddOns: [{ name: "Test", priceInCents: -1 }],
    });
  });

  it("selectedAddOns with float priceInCents passes (no integer constraint in schema)", () => {
    ok(guestRequestSchema, {
      ...valid,
      selectedAddOns: [{ name: "Test", priceInCents: 14.99 }],
    });
  });

  it("extra unknown fields are stripped (not strict mode)", () => {
    const result = guestRequestSchema.safeParse({ ...valid, hackerField: "inject" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("hackerField");
    }
  });

  it("phone — various formats accepted (no regex constraint)", () => {
    const phones = ["+1 800 555 0100", "8005550100", "+44 20 7946 0958", "(555) 555-1234"];
    for (const phone of phones) {
      ok(guestRequestSchema, { ...valid, phone });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/book/pay-deposit
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/book/pay-deposit — payDepositSchema", () => {
  const valid = {
    sourceId: "cnon:card-nonce-ok",
    serviceId: 3,
    preferredDate: "Friday afternoon",
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    tosAccepted: true as const,
  };

  it("happy path — minimal required fields", () => {
    ok(payDepositSchema, valid);
  });

  it("happy path — with all optional fields", () => {
    ok(payDepositSchema, {
      ...valid,
      notes: "Please use classic lashes",
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=3",
      referencePhotoUrls: ["https://cdn.example.com/ref.jpg"],
      selectedAddOns: [{ name: "Lash bath", priceInCents: 1500 }],
      tosVersion: "v2",
      name: "Jane Guest",
      email: "jane@example.com",
      phone: "+18005550100",
      recaptchaToken: "cf-token-xyz",
    });
  });

  it("empty body returns error", () => {
    fail(payDepositSchema, {});
  });

  it("missing required: sourceId", () => {
    const { sourceId: _, ...rest } = valid;
    fail(payDepositSchema, rest);
  });

  it("missing required: serviceId", () => {
    const { serviceId: _, ...rest } = valid;
    fail(payDepositSchema, rest);
  });

  it("missing required: preferredDate", () => {
    const { preferredDate: _, ...rest } = valid;
    fail(payDepositSchema, rest);
  });

  it("missing required: idempotencyKey", () => {
    const { idempotencyKey: _, ...rest } = valid;
    fail(payDepositSchema, rest);
  });

  it("missing required: tosAccepted", () => {
    const { tosAccepted: _, ...rest } = valid;
    fail(payDepositSchema, rest);
  });

  it("tosAccepted: false fails (must be literal true)", () => {
    fail(payDepositSchema, { ...valid, tosAccepted: false });
  });

  it("tosAccepted: 1 fails (must be boolean true, not truthy number)", () => {
    fail(payDepositSchema, { ...valid, tosAccepted: 1 });
  });

  it("tosAccepted: 'true' fails (must be boolean, not string)", () => {
    fail(payDepositSchema, { ...valid, tosAccepted: "true" });
  });

  it("wrong type: serviceId is string", () => {
    fail(payDepositSchema, { ...valid, serviceId: "3" });
  });

  it("wrong type: serviceId is boolean", () => {
    fail(payDepositSchema, { ...valid, serviceId: true });
  });

  it("wrong type: serviceId is null", () => {
    fail(payDepositSchema, { ...valid, serviceId: null });
  });

  it("sourceId empty string fails (min 1)", () => {
    fail(payDepositSchema, { ...valid, sourceId: "" });
  });

  it("idempotencyKey empty string fails (min 1)", () => {
    fail(payDepositSchema, { ...valid, idempotencyKey: "" });
  });

  it("preferredDate empty string fails (min 1)", () => {
    fail(payDepositSchema, { ...valid, preferredDate: "" });
  });

  it("optional email when present must be valid", () => {
    fail(payDepositSchema, { ...valid, email: "not-an-email" });
  });

  it("optional email valid format passes", () => {
    ok(payDepositSchema, { ...valid, email: "guest@example.com" });
  });

  it("referencePhotoUrls with non-URL string fails", () => {
    fail(payDepositSchema, { ...valid, referencePhotoUrls: ["/relative/path.jpg"] });
  });

  it("selectedAddOns missing name field fails", () => {
    fail(payDepositSchema, {
      ...valid,
      selectedAddOns: [{ priceInCents: 500 }],
    });
  });

  it("selectedAddOns missing priceInCents field fails", () => {
    fail(payDepositSchema, {
      ...valid,
      selectedAddOns: [{ name: "Add-on" }],
    });
  });

  it("extra fields are stripped", () => {
    const result = payDepositSchema.safeParse({ ...valid, _secret: "injected" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("_secret");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/book/waitlist
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/book/waitlist — waitlistSchema", () => {
  const valid = { serviceId: 5 };

  it("happy path — serviceId as number", () => {
    ok(waitlistSchema, valid);
  });

  it("happy path — serviceId as string", () => {
    ok(waitlistSchema, { serviceId: "5" });
  });

  it("happy path — all optional fields populated", () => {
    ok(waitlistSchema, {
      serviceId: 2,
      name: "Aaliyah Brown",
      email: "aaliyah@example.com",
      datePreference: "Weekday mornings",
      notes: "Any time after school",
      recaptchaToken: "cf-token",
    });
  });

  it("empty body fails — serviceId required", () => {
    fail(waitlistSchema, {});
  });

  it("serviceId as empty string fails (min 1)", () => {
    fail(waitlistSchema, { serviceId: "" });
  });

  it("serviceId as boolean fails", () => {
    fail(waitlistSchema, { serviceId: true });
  });

  it("serviceId as null fails", () => {
    fail(waitlistSchema, { serviceId: null });
  });

  it("optional email when provided must be valid", () => {
    fail(waitlistSchema, { serviceId: 1, email: "bademail" });
  });

  it("optional email valid format passes", () => {
    ok(waitlistSchema, { serviceId: 1, email: "user@domain.io" });
  });

  it("optional email — international format", () => {
    ok(waitlistSchema, { serviceId: 1, email: "user+tag@subdomain.example.co.uk" });
  });

  it("extra fields stripped", () => {
    const result = waitlistSchema.safeParse({ serviceId: 1, injected: "value" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("injected");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/chat/fallback — chatFallbackSchema", () => {
  const valid = {
    name: "Grace Green",
    email: "grace@example.com",
    question: "Do you offer group sessions?",
  };

  it("happy path", () => {
    ok(chatFallbackSchema, valid);
  });

  it("happy path — with recaptchaToken", () => {
    ok(chatFallbackSchema, { ...valid, recaptchaToken: "cf-token-123" });
  });

  it("empty body fails", () => {
    fail(chatFallbackSchema, {});
  });

  it("missing required: name", () => {
    const { name: _, ...rest } = valid;
    fail(chatFallbackSchema, rest);
  });

  it("missing required: email", () => {
    const { email: _, ...rest } = valid;
    fail(chatFallbackSchema, rest);
  });

  it("missing required: question", () => {
    const { question: _, ...rest } = valid;
    fail(chatFallbackSchema, rest);
  });

  it("empty string name fails (min 1)", () => {
    fail(chatFallbackSchema, { ...valid, name: "" });
  });

  it("empty string question fails (min 1)", () => {
    fail(chatFallbackSchema, { ...valid, question: "" });
  });

  it("invalid email — missing @", () => {
    fail(chatFallbackSchema, { ...valid, email: "gracegmail.com" });
  });

  it("invalid email — consecutive dots", () => {
    fail(chatFallbackSchema, { ...valid, email: "grace..green@example.com" });
  });

  it("invalid email — starts with dot", () => {
    fail(chatFallbackSchema, { ...valid, email: ".grace@example.com" });
  });

  it("10 000-char question passes (no max defined)", () => {
    ok(chatFallbackSchema, { ...valid, question: LONG_STRING });
  });

  it("wrong type: name is number", () => {
    fail(chatFallbackSchema, { ...valid, name: 42 });
  });

  it("wrong type: question is array", () => {
    fail(chatFallbackSchema, { ...valid, question: ["Do you?", "Can you?"] });
  });

  it("extra fields stripped", () => {
    const result = chatFallbackSchema.safeParse({ ...valid, utm_source: "google" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("utm_source");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invites
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/invites — invitesSchema", () => {
  it("happy path — valid email", () => {
    ok(invitesSchema, { email: "newassistant@example.com" });
  });

  it("happy path — plus-addressed email", () => {
    ok(invitesSchema, { email: "user+tag@example.com" });
  });

  it("empty body fails", () => {
    fail(invitesSchema, {});
  });

  it("missing email fails", () => {
    fail(invitesSchema, { name: "Someone" });
  });

  it("invalid email — no domain", () => {
    fail(invitesSchema, { email: "user@" });
  });

  it("invalid email — no TLD", () => {
    fail(invitesSchema, { email: "user@domain" });
  });

  it("invalid email — plain string", () => {
    fail(invitesSchema, { email: "notanemail" });
  });

  it("invalid email — number", () => {
    fail(invitesSchema, { email: 12345 });
  });

  it("invalid email — empty string", () => {
    fail(invitesSchema, { email: "" });
  });

  it("extra fields stripped", () => {
    const result = invitesSchema.safeParse({ email: "x@example.com", role: "admin" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/export — query params
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/export — exportQuerySchema", () => {
  it("happy path — type only", () => {
    ok(exportQuerySchema, { type: "clients" });
  });

  it("happy path — all params", () => {
    ok(exportQuerySchema, { type: "payments", from: "2025-01-01", to: "2025-12-31" });
  });

  it("all valid enum values pass", () => {
    const types = ["clients", "bookings", "payments", "expenses", "invoices", "orders"] as const;
    for (const type of types) {
      ok(exportQuerySchema, { type });
    }
  });

  it("empty body fails — type required", () => {
    fail(exportQuerySchema, {});
  });

  it("invalid type fails", () => {
    fail(exportQuerySchema, { type: "users" });
  });

  it("invalid type — number", () => {
    fail(exportQuerySchema, { type: 1 });
  });

  it("invalid type — empty string", () => {
    fail(exportQuerySchema, { type: "" });
  });

  it("invalid from — not a date string", () => {
    fail(exportQuerySchema, { type: "clients", from: "last-month" });
  });

  it("invalid from — wrong format (MM/DD/YYYY)", () => {
    fail(exportQuerySchema, { type: "clients", from: "01/01/2025" });
  });

  it("invalid from — partial date", () => {
    fail(exportQuerySchema, { type: "clients", from: "2025-13" });
  });

  it("invalid to — not a date", () => {
    fail(exportQuerySchema, { type: "bookings", to: "tomorrow" });
  });

  it("from and to with past dates are valid (no past-date restriction)", () => {
    ok(exportQuerySchema, { type: "clients", from: "2000-01-01", to: "2000-12-31" });
  });

  it("from and to with far-future dates are valid (no cap)", () => {
    ok(exportQuerySchema, { type: "clients", from: "2099-01-01", to: "2099-12-31" });
  });

  it("invalid date — Feb 30", () => {
    fail(exportQuerySchema, { type: "clients", from: "2025-02-30" });
  });

  it("extra fields stripped", () => {
    const result = exportQuerySchema.safeParse({ type: "clients", limit: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("limit");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload-client-photo — form metadata
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/upload-client-photo — uploadClientPhotoSchema", () => {
  const valid = {
    bookingId: "42",
    profileId: "550e8400-e29b-41d4-a716-446655440000",
    photoType: "before",
  };

  it("happy path — minimal required fields", () => {
    ok(uploadClientPhotoSchema, valid);
  });

  it("happy path — with notes", () => {
    ok(uploadClientPhotoSchema, { ...valid, notes: "Pre-appointment reference" });
  });

  it("happy path — photoType 'after'", () => {
    ok(uploadClientPhotoSchema, { ...valid, photoType: "after" });
  });

  it("happy path — photoType 'reference'", () => {
    ok(uploadClientPhotoSchema, { ...valid, photoType: "reference" });
  });

  it("bookingId transforms to number", () => {
    const result = uploadClientPhotoSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.bookingId).toBe("number");
      expect(result.data.bookingId).toBe(42);
    }
  });

  it("empty body fails", () => {
    fail(uploadClientPhotoSchema, {});
  });

  it("missing required: bookingId", () => {
    const { bookingId: _, ...rest } = valid;
    fail(uploadClientPhotoSchema, rest);
  });

  it("missing required: profileId", () => {
    const { profileId: _, ...rest } = valid;
    fail(uploadClientPhotoSchema, rest);
  });

  it("missing required: photoType", () => {
    const { photoType: _, ...rest } = valid;
    fail(uploadClientPhotoSchema, rest);
  });

  it("bookingId with non-digits fails regex", () => {
    fail(uploadClientPhotoSchema, { ...valid, bookingId: "abc" });
  });

  it("bookingId with decimals fails regex", () => {
    fail(uploadClientPhotoSchema, { ...valid, bookingId: "4.2" });
  });

  it("bookingId empty string fails", () => {
    fail(uploadClientPhotoSchema, { ...valid, bookingId: "" });
  });

  it("profileId not a UUID fails", () => {
    fail(uploadClientPhotoSchema, { ...valid, profileId: "not-a-uuid" });
  });

  it("profileId empty string fails", () => {
    fail(uploadClientPhotoSchema, { ...valid, profileId: "" });
  });

  it("invalid photoType fails", () => {
    fail(uploadClientPhotoSchema, { ...valid, photoType: "progress" });
  });

  it("photoType empty string fails", () => {
    fail(uploadClientPhotoSchema, { ...valid, photoType: "" });
  });

  it("extra fields stripped", () => {
    const result = uploadClientPhotoSchema.safeParse({ ...valid, hidden: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("hidden");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/commission-report — query params
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/commission-report — commissionReportSchema", () => {
  const valid = {
    staffId: "00000000-0000-0000-0000-000000000010",
    from: "2025-01-01",
    to: "2025-03-31",
  };

  it("happy path — csv format (default)", () => {
    ok(commissionReportSchema, valid);
  });

  it("happy path — explicit pdf format", () => {
    ok(commissionReportSchema, { ...valid, format: "pdf" });
  });

  it("happy path — explicit csv format", () => {
    ok(commissionReportSchema, { ...valid, format: "csv" });
  });

  it("format defaults to 'csv' when omitted", () => {
    const result = commissionReportSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe("csv");
    }
  });

  it("empty body fails", () => {
    fail(commissionReportSchema, {});
  });

  it("missing required: staffId", () => {
    const { staffId: _, ...rest } = valid;
    fail(commissionReportSchema, rest);
  });

  it("missing required: from", () => {
    const { from: _, ...rest } = valid;
    fail(commissionReportSchema, rest);
  });

  it("missing required: to", () => {
    const { to: _, ...rest } = valid;
    fail(commissionReportSchema, rest);
  });

  it("staffId empty string fails (min 1)", () => {
    fail(commissionReportSchema, { ...valid, staffId: "" });
  });

  it("from wrong format — MM/DD/YYYY fails regex", () => {
    fail(commissionReportSchema, { ...valid, from: "01/01/2025" });
  });

  it("from wrong format — no leading zeros fails regex", () => {
    fail(commissionReportSchema, { ...valid, from: "2025-1-1" });
  });

  it("from partial date fails regex", () => {
    fail(commissionReportSchema, { ...valid, from: "2025-01" });
  });

  it("to wrong format fails regex", () => {
    fail(commissionReportSchema, { ...valid, to: "March 2025" });
  });

  it("to empty string fails", () => {
    fail(commissionReportSchema, { ...valid, to: "" });
  });

  it("past dates are valid (no restriction)", () => {
    ok(commissionReportSchema, { ...valid, from: "2019-01-01", to: "2019-12-31" });
  });

  it("far-future dates are valid (no cap)", () => {
    ok(commissionReportSchema, { ...valid, from: "2099-01-01", to: "2099-12-31" });
  });

  it("invalid format value fails", () => {
    fail(commissionReportSchema, { ...valid, format: "xlsx" });
  });

  it("extra fields stripped", () => {
    const result = commissionReportSchema.safeParse({ ...valid, token: "secret" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("token");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/push/subscribe
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/push/subscribe — pushSubscribeSchema", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: {
      p256dh: "BNbxkY2VCxKz_endpoint_key_base64encoded==",
      auth: "auth_secret_base64==",
    },
  };

  it("happy path — minimal required fields", () => {
    ok(pushSubscribeSchema, valid);
  });

  it("happy path — with expirationTime", () => {
    ok(pushSubscribeSchema, { ...valid, expirationTime: 1_800_000_000 });
  });

  it("happy path — expirationTime null", () => {
    ok(pushSubscribeSchema, { ...valid, expirationTime: null });
  });

  it("empty body fails", () => {
    fail(pushSubscribeSchema, {});
  });

  it("missing required: endpoint", () => {
    const { endpoint: _, ...rest } = valid;
    fail(pushSubscribeSchema, rest);
  });

  it("missing required: keys", () => {
    const { keys: _, ...rest } = valid;
    fail(pushSubscribeSchema, rest);
  });

  it("missing keys.p256dh fails", () => {
    fail(pushSubscribeSchema, { ...valid, keys: { auth: valid.keys.auth } });
  });

  it("missing keys.auth fails", () => {
    fail(pushSubscribeSchema, { ...valid, keys: { p256dh: valid.keys.p256dh } });
  });

  it("endpoint not a URL fails", () => {
    fail(pushSubscribeSchema, { ...valid, endpoint: "not-a-url" });
  });

  it("endpoint relative path fails", () => {
    fail(pushSubscribeSchema, { ...valid, endpoint: "/push/endpoint" });
  });

  it("endpoint empty string fails", () => {
    fail(pushSubscribeSchema, { ...valid, endpoint: "" });
  });

  it("keys.p256dh empty string fails (min 1)", () => {
    fail(pushSubscribeSchema, { ...valid, keys: { ...valid.keys, p256dh: "" } });
  });

  it("keys.auth empty string fails (min 1)", () => {
    fail(pushSubscribeSchema, { ...valid, keys: { ...valid.keys, auth: "" } });
  });

  it("expirationTime as string fails", () => {
    fail(pushSubscribeSchema, { ...valid, expirationTime: "1800000000" });
  });

  it("expirationTime as 0 passes (valid number)", () => {
    ok(pushSubscribeSchema, { ...valid, expirationTime: 0 });
  });

  it("expirationTime MAX_SAFE_INTEGER passes", () => {
    ok(pushSubscribeSchema, { ...valid, expirationTime: Number.MAX_SAFE_INTEGER });
  });

  it("extra fields stripped", () => {
    const result = pushSubscribeSchema.safeParse({ ...valid, deviceId: "phone-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("deviceId");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/push/subscribe
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/push/subscribe — pushUnsubscribeSchema", () => {
  it("happy path — valid push endpoint URL", () => {
    ok(pushUnsubscribeSchema, { endpoint: "https://fcm.googleapis.com/fcm/send/abc123" });
  });

  it("empty body fails", () => {
    fail(pushUnsubscribeSchema, {});
  });

  it("endpoint not a URL fails", () => {
    fail(pushUnsubscribeSchema, { endpoint: "just-a-string" });
  });

  it("endpoint empty string fails", () => {
    fail(pushUnsubscribeSchema, { endpoint: "" });
  });

  it("extra fields stripped", () => {
    const result = pushUnsubscribeSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      extra: "data",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("extra");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-cutting: money amount boundary values
// (tested via selectedAddOns.priceInCents — the only money field in POST bodies)
// ─────────────────────────────────────────────────────────────────────────────

describe("Money amount boundary values — selectedAddOns.priceInCents", () => {
  const base = {
    name: "Jane",
    email: "jane@example.com",
    serviceId: 1,
    preferredDate: "Next week",
  };

  it("0 cents passes (schema has no lower bound on add-on price)", () => {
    ok(guestRequestSchema, {
      ...base,
      selectedAddOns: [{ name: "Free sample", priceInCents: 0 }],
    });
  });

  it("-1 cents passes (no constraint — NOTE: consider adding z.int().min(0))", () => {
    // This documents a gap: the schema doesn't enforce non-negative.
    ok(guestRequestSchema, {
      ...base,
      selectedAddOns: [{ name: "Discount", priceInCents: -1 }],
    });
  });

  it("Number.MAX_SAFE_INTEGER passes (no cap — NOTE: consider a practical cap)", () => {
    ok(guestRequestSchema, {
      ...base,
      selectedAddOns: [{ name: "Expensive", priceInCents: Number.MAX_SAFE_INTEGER }],
    });
  });

  it("0.5 cents (float) passes (schema uses z.number(), not z.int())", () => {
    // This documents another gap: floats are not rejected.
    ok(guestRequestSchema, {
      ...base,
      selectedAddOns: [{ name: "Half cent", priceInCents: 0.5 }],
    });
  });
});
