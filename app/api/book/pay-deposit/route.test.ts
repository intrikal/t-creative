/**
 * Tests for POST /api/book/pay-deposit — inline deposit payment during booking.
 *
 * Covers:
 *  - Input validation: invalid JSON (400), missing required fields (400),
 *    invalid guest email (400)
 *  - reCAPTCHA bot-check failure for guests (403)
 *  - Square not configured → 503
 *  - Service not found → 404
 *  - Service has no deposit (depositInCents=0) → 400
 *  - Happy path (authenticated user): creates pending booking, charges
 *    deposit via Square, records payment row, fires audit log and
 *    PostHog analytics event, returns { success: true, bookingId }
 *
 * Mocks: db (select/insert/update chains), Square (isSquareConfigured,
 * createSquarePayment), reCAPTCHA verifier, Supabase auth (getUser),
 * logAction, trackEvent, Resend, Sentry, cadence label helper.
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock fns                                                    */
/* ------------------------------------------------------------------ */

const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();

const mockIsSquareConfigured = vi.fn();
const mockCreateSquarePayment = vi.fn();
const mockVerifyRecaptchaToken = vi.fn();
const mockLogAction = vi.fn();
const mockTrackEvent = vi.fn();
const mockIsResendConfigured = vi.fn();
const mockResendSend = vi.fn();
const mockGetUser = vi.fn();

/* ------------------------------------------------------------------ */
/*  DB mock builder using a counter for ordered select() results       */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];

function buildDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++;
      const rows = selectData[idx] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi
        .fn()
        .mockReturnValue(Object.assign([...rows], { limit: vi.fn().mockReturnValue(rows) }));
      chain.limit = vi.fn().mockReturnValue(rows);
      return chain;
    }),
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...v: unknown[]) => {
          mockInsertValues(...v);
          return {
            returning: (...r: unknown[]) => {
              mockInsertReturning(...r);
              return mockInsertReturning.mock.results.at(-1)?.value ?? [{ id: 1 }];
            },
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...s: unknown[]) => {
          mockUpdateSet(...s);
          return {
            where: vi.fn(),
          };
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRequest(body: string): Request {
  return new Request("http://localhost/api/book/pay-deposit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

const validPayload = {
  sourceId: "cnon:card-nonce-ok",
  serviceId: 1,
  preferredDate: "Next Saturday",
  idempotencyKey: "idem-uuid-1234",
};

const validGuestPayload = {
  ...validPayload,
  name: "Alice Guest",
  email: "alice@example.com",
  recaptchaToken: "valid-recaptcha-token",
};

/* ------------------------------------------------------------------ */
/*  doMock helper — registers all vi.doMock() calls                    */
/* ------------------------------------------------------------------ */

function doMockAll() {
  vi.doMock("@/db", () => ({ db: buildDb() }));

  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      status: "status",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      recurrenceRule: "recurrenceRule",
      clientNotes: "clientNotes",
      depositPaidInCents: "depositPaidInCents",
      depositPaidAt: "depositPaidAt",
      squareOrderId: "squareOrderId",
      deletedAt: "deletedAt",
    },
    bookingAddOns: {
      bookingId: "bookingId",
      addOnName: "addOnName",
      priceInCents: "priceInCents",
    },
    payments: {
      bookingId: "bookingId",
      clientId: "clientId",
      amountInCents: "amountInCents",
      method: "method",
      status: "status",
      paidAt: "paidAt",
      squarePaymentId: "squarePaymentId",
      squareOrderId: "squareOrderId",
      squareReceiptUrl: "squareReceiptUrl",
      notes: "notes",
    },
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      role: "role",
    },
    services: {
      id: "id",
      name: "name",
      priceInCents: "priceInCents",
      durationMinutes: "durationMinutes",
      depositInCents: "depositInCents",
    },
    syncLog: {
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      payload: "payload",
    },
  }));

  vi.doMock("drizzle-orm", () => ({ eq: vi.fn((_col: unknown, val: unknown) => val) }));

  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
    createSquarePayment: mockCreateSquarePayment,
  }));

  vi.doMock("@/lib/recaptcha", () => ({
    verifyRecaptchaToken: mockVerifyRecaptchaToken,
  }));

  vi.doMock("@/lib/audit", () => ({
    logAction: mockLogAction,
  }));

  vi.doMock("@/lib/posthog", () => ({
    trackEvent: mockTrackEvent,
  }));

  vi.doMock("@/lib/resend", () => ({
    RESEND_FROM: "noreply@test.com",
    isResendConfigured: mockIsResendConfigured,
  }));

  vi.doMock("@/lib/cadence", () => ({
    rruleToCadenceLabel: vi.fn().mockReturnValue("Weekly"),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: mockGetUser },
    }),
  }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  vi.doMock("resend", () => ({
    Resend: function MockResend() {
      return { emails: { send: mockResendSend } };
    },
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/book/pay-deposit", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];

    // Default mock behaviours
    mockIsSquareConfigured.mockReturnValue(true);
    mockCreateSquarePayment.mockResolvedValue({
      paymentId: "sq_pay_1",
      orderId: "sq_ord_1",
      receiptUrl: "https://receipt",
    });
    mockVerifyRecaptchaToken.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockTrackEvent.mockReturnValue(undefined);
    mockIsResendConfigured.mockReturnValue(false);
    mockResendSend.mockResolvedValue({ id: "email-id" });
    mockInsertReturning.mockReturnValue([{ id: 42 }]);
    mockGetUser.mockResolvedValue({ data: { user: null } }); // guest by default

    vi.resetModules();
    doMockAll();

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ---------- Invalid JSON ---------- */

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/book/pay-deposit", {
      method: "POST",
      body: "not valid json {{{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Invalid JSON" });
  });

  /* ---------- Missing required fields ---------- */

  it("returns 400 when required fields are missing", async () => {
    const req = makeRequest(JSON.stringify({ sourceId: "tok_123" }));

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Missing required fields" });
  });

  /* ---------- Invalid guest email ---------- */

  it("returns 400 when guest email is invalid", async () => {
    const req = makeRequest(
      JSON.stringify({
        ...validGuestPayload,
        email: "notanemail",
      }),
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Invalid email" });
  });

  /* ---------- reCAPTCHA failure ---------- */

  it("returns 403 when reCAPTCHA verification fails", async () => {
    mockVerifyRecaptchaToken.mockResolvedValue(false);

    const req = makeRequest(JSON.stringify(validGuestPayload));

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Bot check failed");
  });

  /* ---------- Square not configured ---------- */

  it("returns 503 when Square is not configured", async () => {
    mockIsSquareConfigured.mockReturnValue(false);

    const req = makeRequest(JSON.stringify(validGuestPayload));

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Payments not configured" });
  });

  /* ---------- Service not found ---------- */

  it("returns 404 when service not found", async () => {
    // selectData[0] = [] → service lookup returns empty (default)

    const req = makeRequest(JSON.stringify(validGuestPayload));

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Service not found" });
  });

  /* ---------- Service has no deposit ---------- */

  it("returns 400 when service has no deposit", async () => {
    // selectData[0] = service found but depositInCents is 0
    selectData[0] = [
      {
        name: "Haircut",
        priceInCents: 5000,
        durationMinutes: 60,
        depositInCents: 0,
      },
    ];

    const req = makeRequest(JSON.stringify(validGuestPayload));

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("does not require a deposit");
  });

  /* ---------- Success for authenticated user ---------- */

  it("returns 200 with bookingId on success for authenticated user", async () => {
    // Authenticated user instead of guest
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    // selectData[0] = service with depositInCents: 5000
    selectData[0] = [
      {
        name: "Haircut",
        priceInCents: 10000,
        durationMinutes: 60,
        depositInCents: 5000,
      },
    ];
    // selectData[1] = admin profile for email notification at the end
    selectData[1] = [{ id: "admin-1", email: "admin@test.com", firstName: "Admin" }];

    mockCreateSquarePayment.mockResolvedValue({
      paymentId: "sq_pay_1",
      orderId: "sq_ord_1",
      receiptUrl: "https://receipt",
    });
    mockInsertReturning.mockReturnValue([{ id: 42 }]);

    const req = makeRequest(JSON.stringify(validPayload));

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, bookingId: 42 });

    // Square payment should have been called with the deposit amount
    expect(mockCreateSquarePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 42,
        amountInCents: 5000,
        sourceId: validPayload.sourceId,
        idempotencyKey: validPayload.idempotencyKey,
      }),
    );

    // Audit log and analytics should fire
    expect(mockLogAction).toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "user-1",
      "deposit_paid_inline",
      expect.objectContaining({ bookingId: 42, amountInCents: 5000, isGuest: false }),
    );
  });
});
