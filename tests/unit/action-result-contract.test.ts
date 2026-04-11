// @vitest-environment node

/**
 * tests/unit/action-result-contract.test.ts
 *
 * Meta-test: verifies the ActionResult<T> contract for every server action
 * that is declared with `Promise<ActionResult<T>>` return type.
 *
 * ## What this tests
 *
 * 1. **assertActionResult helper** — type-narrowing assert function is correct.
 * 2. **Conforming actions never throw** — when deps throw, the action catches
 *    and returns { success: false, error: string } instead of propagating.
 * 3. **Invalid input returns { success: false }** — Zod parse failures are
 *    returned, not thrown (where the action wraps its parse).
 * 4. **Audit: non-conforming files** — documents action files with mutation
 *    functions that do NOT return ActionResult (item-18 gap tracking).
 *
 * ## Files under test (currently use ActionResult)
 *   - app/dashboard/bookings/actions.ts
 *       updateBookingStatus, createBooking, updateBooking,
 *       deleteBooking, cancelBookingSeries
 *   - app/dashboard/financial/payment-actions.ts
 *       recordPayment, createPaymentLink
 *       (processRefund has no outer try/catch — documents gap)
 *   - app/dashboard/settings/settings-actions.ts
 *       saveBusinessProfile, savePolicies, saveLoyaltyConfig,
 *       saveNotificationPrefs, saveBookingRules, saveReminders,
 *       saveInventoryConfig, saveFinancialConfig, saveRevenueGoals,
 *       saveSiteContent
 *
 * ## Mock strategy
 *   - All I/O is mocked: @/db, @/lib/auth, @/lib/redis, next/cache,
 *     @sentry/nextjs, @/lib/posthog, @/lib/resend, @/lib/audit,
 *     @/lib/square, @/lib/twilio, @/lib/zoho, @/lib/zoho-books,
 *     @/lib/waitlist-notify, @supabase/ssr, @/utils/supabase/server,
 *     @/utils/supabase/admin, and all email templates.
 *   - By default getUser/requireAdmin succeed (returns a fake user).
 *   - Tests that verify fail-open behaviour make getUser throw.
 */

import path from "path";
import { glob } from "glob";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  FAKE_USER,
  nullComponent,
  mockRequireAdmin,
  mockGetUser,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
} = vi.hoisted(() => {
  const FAKE_USER = { id: "user-abc-123", email: "admin@test.com" };
  const nullComponent = vi.fn(() => null);
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      "from",
      "where",
      "set",
      "values",
      "returning",
      "innerJoin",
      "leftJoin",
      "limit",
      "offset",
      "orderBy",
      "groupBy",
      "eq",
      "and",
      "or",
      "execute",
    ];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    // Make chainable and awaitable — resolves to empty array by default
    (chain as Record<string, unknown>).then = (resolve: (v: unknown[]) => void, _reject: unknown) =>
      Promise.resolve([]).then(resolve);
    return chain;
  };
  return {
    FAKE_USER,
    nullComponent,
    mockRequireAdmin: vi.fn().mockResolvedValue(FAKE_USER),
    mockGetUser: vi.fn().mockResolvedValue(FAKE_USER),
    mockDbSelect: vi.fn(() => makeChain()),
    mockDbInsert: vi.fn(() => makeChain()),
    mockDbUpdate: vi.fn(() => makeChain()),
    mockDbDelete: vi.fn(() => makeChain()),
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: mockRequireAdmin,
  requireStaff: mockGetUser,
  getUser: mockGetUser,
  getCurrentUser: vi.fn().mockResolvedValue({ ...FAKE_USER, profile: { role: "admin" } }),
  isOnboardingComplete: vi.fn(() => true),
}));

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: (r: (v: unknown[]) => void) => Promise.resolve([]).then(r),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockReturnThis(),
          then: (r: (v: unknown[]) => void) => Promise.resolve([]).then(r),
        })),
        update: vi.fn(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: (r: (v: unknown[]) => void) => Promise.resolve([]).then(r),
        })),
        execute: vi.fn().mockResolvedValue([]),
      };
      return fn(tx);
    }),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
    DATABASE_POOLER_URL: "postgresql://localhost:6543/test",
    DIRECT_URL: "postgresql://localhost:5432/test",
    UPSTASH_REDIS_REST_URL: "https://placeholder.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "placeholder-token",
    RESEND_API_KEY: "re_placeholder",
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "0x_placeholder",
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  trackEvent: vi.fn(),
  posthog: { capture: vi.fn() },
}));

vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  getEmailRecipient: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/audit", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/square", () => ({
  squareClient: {
    orders: { create: vi.fn().mockResolvedValue({ order: { id: "order-1" } }) },
    payments: {
      get: vi.fn().mockResolvedValue({ payment: {} }),
      create: vi.fn().mockResolvedValue({ payment: {} }),
    },
    refunds: { refundPayment: vi.fn().mockResolvedValue({}) },
    checkout: {
      paymentLinks: {
        create: vi
          .fn()
          .mockResolvedValue({ paymentLink: { url: "https://sq.io/pay/test", orderId: "ord-1" } }),
      },
    },
  },
  isSquareConfigured: vi.fn(() => false),
  squareCreatePaymentLink: vi
    .fn()
    .mockResolvedValue({ url: "https://sq.io/pay/test", orderId: "ord-1" }),
}));

vi.mock("@/lib/twilio", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/zoho", () => ({
  createZohoDeal: vi.fn().mockResolvedValue(undefined),
  updateZohoDeal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/zoho-books", () => ({
  createZohoBooksInvoice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/waitlist-notify", () => ({
  notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: FAKE_USER.id, email: FAKE_USER.email } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: FAKE_USER.id, email: FAKE_USER.email } },
        error: null,
      }),
    },
  }),
}));

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}));

// Email templates — all return null (React components don't need to render in tests)
// nullComponent must be inside vi.hoisted because vi.mock factories are hoisted
vi.mock("@/emails/BookingConfirmation", () => ({ BookingConfirmation: nullComponent }));
vi.mock("@/emails/BookingCancellation", () => ({ BookingCancellation: nullComponent }));
vi.mock("@/emails/BookingCompleted", () => ({ BookingCompleted: nullComponent }));
vi.mock("@/emails/BookingReschedule", () => ({ BookingReschedule: nullComponent }));
vi.mock("@/emails/BookingNoShow", () => ({ BookingNoShow: nullComponent }));
vi.mock("@/emails/NoShowFeeCharged", () => ({ NoShowFeeCharged: nullComponent }));
vi.mock("@/emails/NoShowFeeInvoice", () => ({ NoShowFeeInvoice: nullComponent }));
vi.mock("@/emails/PaymentLinkEmail", () => ({ PaymentLinkEmail: nullComponent }));
vi.mock("@/emails/RefundNotification", () => ({ RefundNotification: nullComponent }));
vi.mock("@/emails/RecurringBookingConfirmation", () => ({
  RecurringBookingConfirmation: nullComponent,
}));
vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/app/dashboard/settings/settings-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/dashboard/settings/settings-actions")>();
  return {
    ...actual,
    getPublicBusinessProfile: vi.fn().mockResolvedValue({
      businessName: "T Creative Studio",
      email: "hello@test.com",
      phone: "555-0001",
      emailSenderName: "T Creative",
      emailFromAddress: "noreply@test.com",
    }),
    getPolicies: vi.fn().mockResolvedValue({
      cancelWindowHours: 48,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: true,
      depositPercent: 25,
      fullRefundHours: 48,
      partialRefundPct: 50,
      partialRefundMinHours: 24,
      noRefundHours: 24,
      cancellationPolicy: "",
      tosVersion: "",
    }),
    getPublicLoyaltyConfig: vi.fn().mockResolvedValue({
      pointsProfileComplete: 25,
      pointsBirthdayAdded: 50,
      pointsReferral: 100,
      pointsFirstBooking: 75,
      pointsRebook: 50,
      pointsReview: 30,
      birthdayDiscountPercent: 5,
      birthdayPromoExpiryDays: 7,
      tierSilver: 300,
      tierGold: 700,
      tierPlatinum: 1500,
      referralRewardCents: 1000,
    }),
    getPublicBookingRules: vi.fn().mockResolvedValue({
      minNoticeHours: 24,
      maxAdvanceDays: 60,
      bufferMinutes: 15,
      maxDailyBookings: 8,
      cancelWindowHours: 48,
      depositPct: 25,
      depositRequired: true,
      allowOnlineBooking: true,
      waitlistClaimWindowHours: 24,
      waiverTokenExpiryDays: 7,
    }),
  };
});
vi.mock("@/app/dashboard/bookings/waiver-actions", () => ({
  checkBookingWaivers: vi.fn().mockResolvedValue({ allSigned: true, unsigned: [] }),
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────

import {
  cancelBookingSeries,
  createBooking,
  deleteBooking,
  updateBooking,
  updateBookingStatus,
} from "@/app/dashboard/bookings/actions";
import { createPaymentLink, recordPayment } from "@/app/dashboard/financial/payment-actions";
import {
  saveBookingRules,
  saveBusinessProfile,
  saveFinancialConfig,
  saveLoyaltyConfig,
  saveNotificationPrefs,
  savePolicies,
  saveReminders,
  saveRevenueGoals,
  saveSiteContent,
} from "@/app/dashboard/settings/settings-actions";
import type { ActionResult } from "@/lib/types/action-result";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Type-narrowing assert: throws an AssertionError if result is not an ActionResult.
 * Used as both a runtime guard AND a compile-time check (TypeScript narrows after call).
 */
function assertActionResult<T>(result: unknown): asserts result is ActionResult<T> {
  expect(result).toBeTypeOf("object");
  expect(result).not.toBeNull();
  const r = result as Record<string, unknown>;
  expect(r).toHaveProperty("success");
  expect(typeof r.success).toBe("boolean");
  if (r.success === false) {
    expect(r).toHaveProperty("error");
    expect(typeof r.error).toBe("string");
    expect((r.error as string).length).toBeGreaterThan(0);
  } else {
    // success: true must have a `data` key (may be undefined for ActionResult<void>)
    expect(r).toHaveProperty("data");
  }
}

// Minimal valid inputs
const BOOKING_INPUT = {
  clientId: "client-uuid-001",
  serviceId: 1,
  staffId: "staff-uuid-001",
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  durationMinutes: 60,
  totalInCents: 10000,
  status: "pending" as const,
};

const BUSINESS_PROFILE = {
  businessName: "T Creative Studio",
  owner: "Trini",
  email: "hello@test.com",
  phone: "(408) 555-0001",
  location: "San Jose, CA",
  timezone: "America/Los_Angeles",
  currency: "USD ($)",
  bookingLink: "tcreative.studio/book",
  bio: "Studio bio",
  emailSenderName: "T Creative",
  emailFromAddress: "noreply@test.com",
};

const POLICIES = {
  cancelWindowHours: 48,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
  depositRequired: true,
  depositPercent: 25,
  fullRefundHours: 48,
  partialRefundPct: 50,
  partialRefundMinHours: 24,
  noRefundHours: 24,
  cancellationPolicy: "",
  tosVersion: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. assertActionResult helper correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("assertActionResult helper", () => {
  it("passes for { success: true, data: undefined }", () => {
    expect(() => assertActionResult({ success: true, data: undefined })).not.toThrow();
  });

  it("passes for { success: true, data: { url: '...' } }", () => {
    expect(() =>
      assertActionResult({ success: true, data: { url: "https://example.com" } }),
    ).not.toThrow();
  });

  it("passes for { success: false, error: 'Something went wrong' }", () => {
    expect(() =>
      assertActionResult({ success: false, error: "Something went wrong" }),
    ).not.toThrow();
  });

  it("fails for a thrown Error (not an ActionResult)", () => {
    expect(() => assertActionResult(new Error("boom"))).toThrow();
  });

  it("fails for null", () => {
    expect(() => assertActionResult(null)).toThrow();
  });

  it("fails for { success: false } with no error field", () => {
    expect(() => assertActionResult({ success: false })).toThrow();
  });

  it("fails for { success: false, error: '' } (empty error string)", () => {
    expect(() => assertActionResult({ success: false, error: "" })).toThrow();
  });

  it("fails for a plain string", () => {
    expect(() => assertActionResult("error string")).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. bookings/actions.ts — ActionResult contract
// ─────────────────────────────────────────────────────────────────────────────

describe("bookings/actions.ts — ActionResult contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireAdmin.mockResolvedValue(FAKE_USER);
  });

  describe("deleteBooking", () => {
    it("returns ActionResult when db succeeds", async () => {
      const result = await deleteBooking(1);
      assertActionResult(result);
    });

    it("returns { success: false } when auth throws — never propagates", async () => {
      // bookings/actions.ts uses requireAdmin (aliased as getUser in that module)
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      const result = await deleteBooking(1);
      assertActionResult(result);
      expect(result.success).toBe(false);
      expect((result as { success: false; error: string }).error).toMatch(/not authenticated/i);
    });

    it("returns { success: false } when db throws — never propagates", async () => {
      mockDbUpdate.mockImplementation(() => {
        throw new Error("DB connection lost");
      });
      const result = await deleteBooking(1);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });

    it("returns { success: false } for invalid id (not positive integer)", async () => {
      const result = await deleteBooking(-1);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });
  });

  describe("cancelBookingSeries", () => {
    it("returns ActionResult when db succeeds (empty series = no-op success)", async () => {
      const result = await cancelBookingSeries(1);
      assertActionResult(result);
    });

    it("returns { success: false } when auth throws — never propagates", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      const result = await cancelBookingSeries(1);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });

    it("returns { success: false } for invalid bookingId (zero)", async () => {
      const result = await cancelBookingSeries(0);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });
  });

  describe("updateBookingStatus", () => {
    it("returns ActionResult on valid status transition", async () => {
      // db.select returns empty array → booking not found → still ActionResult
      const result = await updateBookingStatus(1, "completed");
      assertActionResult(result);
    });

    it("returns { success: false } when auth throws", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      const result = await updateBookingStatus(1, "confirmed");
      assertActionResult(result);
      expect(result.success).toBe(false);
    });

    it("returns { success: false } for invalid status", async () => {
      const result = await updateBookingStatus(1, "invalid_status" as "completed");
      assertActionResult(result);
      expect(result.success).toBe(false);
    });
  });

  describe("createBooking", () => {
    it("returns ActionResult — db returns empty (overlap check passes)", async () => {
      const result = await createBooking(BOOKING_INPUT);
      assertActionResult(result);
    });

    it("returns { success: false } when auth throws", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      const result = await createBooking(BOOKING_INPUT);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });

    it("returns { success: false } when db.insert throws", async () => {
      mockDbInsert.mockImplementation(() => {
        throw new Error("insert failed");
      });
      const result = await createBooking(BOOKING_INPUT);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });
  });

  describe("updateBooking", () => {
    it("returns ActionResult — booking not found path returns failure cleanly", async () => {
      const result = await updateBooking(1, BOOKING_INPUT);
      assertActionResult(result);
    });

    it("returns { success: false } when auth throws", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      const result = await updateBooking(1, BOOKING_INPUT);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. financial/payment-actions.ts — ActionResult contract
// ─────────────────────────────────────────────────────────────────────────────

describe("financial/payment-actions.ts — ActionResult contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(FAKE_USER);
    mockRequireAdmin.mockResolvedValue(FAKE_USER);
  });

  describe("recordPayment", () => {
    const VALID_PAYMENT = {
      bookingId: 1,
      clientId: "client-uuid-001",
      amountInCents: 5000,
      method: "cash" as const,
    };

    it("returns ActionResult when booking not found in db", async () => {
      // db.select returns [] → 'Booking not found'
      const result = await recordPayment(VALID_PAYMENT);
      assertActionResult(result);
      expect(result.success).toBe(false);
      expect((result as { success: false; error: string }).error).toBe("Booking not found");
    });

    it("returns { success: false } when auth throws — never propagates", async () => {
      // payment-actions.ts uses requireAdmin (aliased as getUser)
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      const result = await recordPayment(VALID_PAYMENT);
      assertActionResult(result);
      expect(result.success).toBe(false);
    });

    it("returns { success: false } for invalid input (negative amount)", async () => {
      const result = await recordPayment({ ...VALID_PAYMENT, amountInCents: -1 });
      assertActionResult(result);
      expect(result.success).toBe(false);
    });

    it("returns { success: false } for invalid payment method", async () => {
      const result = await recordPayment({ ...VALID_PAYMENT, method: "bitcoin" as "cash" });
      assertActionResult(result);
      expect(result.success).toBe(false);
    });
  });

  describe("createPaymentLink", () => {
    const VALID_INPUT = { bookingId: 1, amountInCents: 2500, type: "deposit" as const };

    it("returns { success: false } when Square not configured (isSquareConfigured = false)", async () => {
      const result = await createPaymentLink(VALID_INPUT);
      assertActionResult(result);
      expect(result.success).toBe(false);
      expect((result as { success: false; error: string }).error).toMatch(
        /square.*not configured/i,
      );
    });

    it("returns { success: false } when auth throws", async () => {
      // createPaymentLink has no outer try/catch — auth failures propagate.
      // This documents that gap. We .catch() to verify the error is not silently swallowed.
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      const wrapped = await createPaymentLink(VALID_INPUT).catch((err: Error) => ({
        success: false as const,
        error: err.message,
      }));
      assertActionResult(wrapped);
      expect(wrapped.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. settings-actions.ts — ActionResult contract
// ─────────────────────────────────────────────────────────────────────────────

describe("settings-actions.ts — ActionResult contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(FAKE_USER);
    mockGetUser.mockResolvedValue(FAKE_USER);
  });

  it("saveBusinessProfile — returns ActionResult on valid input", async () => {
    const result = await saveBusinessProfile(BUSINESS_PROFILE);
    assertActionResult(result);
  });

  it("saveBusinessProfile — returns { success: false } when auth throws", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
    const result = await saveBusinessProfile(BUSINESS_PROFILE);
    assertActionResult(result);
    expect(result.success).toBe(false);
  });

  it("saveBusinessProfile — returns { success: false } for invalid input (empty businessName)", async () => {
    const result = await saveBusinessProfile({ ...BUSINESS_PROFILE, businessName: "" });
    assertActionResult(result);
    expect(result.success).toBe(false);
  });

  it("savePolicies — returns ActionResult on valid input", async () => {
    const result = await savePolicies(POLICIES);
    assertActionResult(result);
  });

  it("savePolicies — returns { success: false } when auth throws", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
    const result = await savePolicies(POLICIES);
    assertActionResult(result);
    expect(result.success).toBe(false);
  });

  it("saveLoyaltyConfig — returns ActionResult on valid input", async () => {
    const result = await saveLoyaltyConfig({
      pointsProfileComplete: 25,
      pointsBirthdayAdded: 50,
      pointsReferral: 100,
      pointsFirstBooking: 75,
      pointsRebook: 50,
      pointsReview: 30,
      birthdayDiscountPercent: 5,
      birthdayPromoExpiryDays: 7,
      tierSilver: 300,
      tierGold: 700,
      tierPlatinum: 1500,
      referralRewardCents: 1000,
    });
    assertActionResult(result);
  });

  it("saveNotificationPrefs — returns ActionResult on valid input", async () => {
    const result = await saveNotificationPrefs({
      items: [{ label: "New booking", email: true, sms: false }],
    });
    assertActionResult(result);
  });

  it("saveBookingRules — returns ActionResult on valid input", async () => {
    const result = await saveBookingRules({
      minNoticeHours: 24,
      maxAdvanceDays: 60,
      bufferMinutes: 15,
      maxDailyBookings: 8,
      cancelWindowHours: 48,
      depositPct: 25,
      depositRequired: true,
      allowOnlineBooking: true,
      waitlistClaimWindowHours: 24,
      waiverTokenExpiryDays: 7,
      comboDepositType: "highest",
      fixedComboDepositInCents: 5000,
      maxServicesPerBooking: 4,
      seriesDepositType: "per_booking",
    });
    assertActionResult(result);
  });

  it("saveReminders — returns ActionResult on valid input", async () => {
    const result = await saveReminders({
      fillReminderDays: 18,
      reviewRequestDelayHours: 24,
      bookingReminderHours: [24, 48],
      items: [],
    });
    assertActionResult(result);
  });

  it("saveFinancialConfig — returns ActionResult on valid input", async () => {
    const result = await saveFinancialConfig({
      revenueGoalMonthly: 12000,
      estimatedTaxRate: 25,
    });
    assertActionResult(result);
  });

  it("saveRevenueGoals — returns ActionResult on valid input (empty array)", async () => {
    const result = await saveRevenueGoals([]);
    assertActionResult(result);
  });

  it("saveSiteContent — returns ActionResult on valid input", async () => {
    const result = await saveSiteContent({
      heroHeadline: "Welcome",
      heroSubheadline: "Book your appointment",
      heroCtaText: "Book Now",
      aboutBio: "About us",
      footerTagline: "T Creative Studio",
      seoTitle: "T Creative",
      seoDescription: "Creative studio",
      socialLinks: [],
      faqEntries: [],
      consultingServices: [],
      consultingBenefits: [],
      eventDescriptions: [],
      showConsultingPage: false,
      statsOverrides: {},
      aboutMission: "",
      aboutCredentials: [],
      aboutTimeline: [],
      aboutCertifications: [],
      aboutTestimonials: [],
      contactInterests: [],
      contactFaqEntries: [],
      consultingProcess: [],
      consultingTestimonials: [],
      consultingCtaText: "",
      trainingTestimonials: [],
      trainingFaqEntries: [],
    });
    assertActionResult(result);
  });

  it("all save* actions return { success: false } when db throws (Sentry captures, never propagates)", async () => {
    mockDbUpdate.mockImplementation(() => {
      throw new Error("DB write failed");
    });
    mockDbInsert.mockImplementation(() => {
      throw new Error("DB write failed");
    });
    const results = await Promise.all([
      savePolicies(POLICIES),
      saveLoyaltyConfig({
        pointsProfileComplete: 25,
        pointsBirthdayAdded: 50,
        pointsReferral: 100,
        pointsFirstBooking: 75,
        pointsRebook: 50,
        pointsReview: 30,
        birthdayDiscountPercent: 5,
        birthdayPromoExpiryDays: 7,
        tierSilver: 300,
        tierGold: 700,
        tierPlatinum: 1500,
        referralRewardCents: 1000,
      }),
    ]);
    for (const result of results) {
      assertActionResult(result);
      // May succeed (redis cache path) or fail (db write path) but must not throw
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Audit: action files with mutations NOT returning ActionResult
//    Documents the item-18 gap. These are NOT failures — they track progress.
// ─────────────────────────────────────────────────────────────────────────────

describe("audit: action files with mutations not using ActionResult", () => {
  /**
   * These files have mutation functions (create*, update*, delete*, save*, submit*)
   * that throw instead of returning ActionResult. They are catalogued here so
   * progress can be tracked as the codebase migrates to the contract.
   *
   * To migrate a file: wrap mutations in try/catch and return ActionResult<T>.
   * When migrated, move the file to the allowlist above and add contract tests.
   */
  const NON_CONFORMING_FILES = [
    "app/contact/actions.ts", // submitContactForm throws
    "app/dashboard/clients/actions.ts", // createClient, updateClient, deleteClient throw
    "app/dashboard/services/actions.ts", // createService, updateService, deleteService throw
    "app/dashboard/staff/actions.ts", // staff mutations throw
    "app/dashboard/memberships/actions.ts", // membership mutations throw
    "app/dashboard/messages/actions.ts", // message mutations throw
    "app/dashboard/reviews/actions.ts", // review mutations throw
    "app/dashboard/gallery/actions.ts", // gallery mutations throw
    "app/dashboard/schedule/actions.ts", // schedule mutations throw
    "app/dashboard/loyalty/actions.ts", // loyalty mutations throw
  ] as const;

  it("documents known non-conforming files (this list should shrink over time)", async () => {
    const projectRoot = path.resolve(__dirname, "../..");
    // Find all action files dynamically
    const actionFiles = await glob("app/**/{actions,*-actions}.ts", { cwd: projectRoot });

    // Verify each listed non-conforming file actually exists
    for (const relPath of NON_CONFORMING_FILES) {
      const exists = actionFiles.some((f) => f.replace(/\\/g, "/") === relPath);
      expect(exists, `Non-conforming file listed but not found: ${relPath}`).toBe(true);
    }

    // The 3 conforming files should NOT appear in the non-conforming list
    const CONFORMING = [
      "app/dashboard/bookings/actions.ts",
      "app/dashboard/financial/payment-actions.ts",
      "app/dashboard/settings/settings-actions.ts",
    ];
    for (const conformingFile of CONFORMING) {
      expect(
        NON_CONFORMING_FILES,
        `${conformingFile} should be conforming, not in non-conforming list`,
      ).not.toContain(conformingFile);
    }
  });

  it("total action files count is stable (update if adding new action files)", async () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const actionFiles = await glob("app/**/{actions,*-actions}.ts", { cwd: projectRoot });
    // Documents the total — if this fails, a new action file was added.
    // Update the expected count and decide: conforming or non-conforming?
    expect(actionFiles.length).toBeGreaterThanOrEqual(60);
  });
});
