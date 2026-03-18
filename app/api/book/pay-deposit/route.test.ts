import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];

const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

const mockIsSquareConfigured = vi.fn();
const mockCreateSquarePayment = vi.fn();
const mockVerifyTurnstileToken = vi.fn();
const mockLogAction = vi.fn();
const mockTrackEvent = vi.fn();
const mockIsResendConfigured = vi.fn();
const mockResendSend = vi.fn();
const mockGetUser = vi.fn();

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
            where: (...w: unknown[]) => {
              mockUpdateWhere(...w);
            },
          };
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
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
      paymentId: "sq_pay_123",
      orderId: "sq_order_456",
      receiptUrl: "https://squareup.com/receipt/test",
    });
    mockVerifyTurnstileToken.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockTrackEvent.mockResolvedValue(undefined);
    mockIsResendConfigured.mockReturnValue(false);
    mockResendSend.mockResolvedValue({ id: "email-id" });
    mockInsertReturning.mockReturnValue([{ id: 42 }]);
    mockGetUser.mockResolvedValue({ data: { user: null } }); // guest by default

    vi.resetModules();

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

    vi.doMock("@/lib/square", () => ({
      isSquareConfigured: mockIsSquareConfigured,
      createSquarePayment: mockCreateSquarePayment,
    }));

    vi.doMock("@/lib/turnstile", () => ({
      verifyTurnstileToken: mockVerifyTurnstileToken,
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

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function makePost(body: unknown) {
    return new Request("https://example.com/api/book/pay-deposit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const validGuestBody = {
    sourceId: "cnon:card-nonce-ok",
    serviceId: 1,
    preferredDate: "Next Saturday",
    idempotencyKey: "idem-uuid-1234",
    name: "Alice Guest",
    email: "alice@example.com",
    turnstileToken: "valid-turnstile-token",
  };

  /* ------------------------------------------------------------------ */
  /*  1. Square not configured                                            */
  /* ------------------------------------------------------------------ */

  it("returns 503 when Square is not configured", async () => {
    mockIsSquareConfigured.mockReturnValue(false);

    const res = await POST(makePost(validGuestBody));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Payments not configured" });
  });

  /* ------------------------------------------------------------------ */
  /*  2. Invalid JSON                                                     */
  /* ------------------------------------------------------------------ */

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("https://example.com/api/book/pay-deposit", {
      method: "POST",
      body: "not json {{{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Invalid JSON" });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Missing required fields                                          */
  /* ------------------------------------------------------------------ */

  it("returns 400 when required fields are missing", async () => {
    // Missing sourceId
    const res = await POST(
      makePost({
        serviceId: 1,
        preferredDate: "Next Saturday",
        idempotencyKey: "idem-uuid-1234",
        name: "Alice Guest",
        email: "alice@example.com",
        turnstileToken: "token",
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Missing required fields" });
  });

  /* ------------------------------------------------------------------ */
  /*  4. Guest without name/email                                         */
  /* ------------------------------------------------------------------ */

  it("returns 400 when guest name/email missing", async () => {
    // guest (no user), body has sourceId etc but no name/email
    const res = await POST(
      makePost({
        sourceId: "cnon:card-nonce-ok",
        serviceId: 1,
        preferredDate: "Next Saturday",
        idempotencyKey: "idem-uuid-1234",
        // no name, no email
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Name and email required for guests" });
  });

  /* ------------------------------------------------------------------ */
  /*  5. Invalid email                                                    */
  /* ------------------------------------------------------------------ */

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      makePost({
        ...validGuestBody,
        email: "notanemail",
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Invalid email" });
  });

  /* ------------------------------------------------------------------ */
  /*  6. Turnstile failure                                                */
  /* ------------------------------------------------------------------ */

  it("returns 403 when Turnstile verification fails", async () => {
    mockVerifyTurnstileToken.mockResolvedValue(false);

    const res = await POST(makePost(validGuestBody));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toMatchObject({ error: expect.stringContaining("Bot check") });
  });

  /* ------------------------------------------------------------------ */
  /*  7. Service not found                                                */
  /* ------------------------------------------------------------------ */

  it("returns 404 when service not found", async () => {
    // selectData[0] = [] → service lookup returns empty (default)

    const res = await POST(makePost(validGuestBody));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Service not found" });
  });

  /* ------------------------------------------------------------------ */
  /*  8. Service has no deposit                                           */
  /* ------------------------------------------------------------------ */

  it("returns 400 when service has no deposit", async () => {
    // selectData[0] = service with depositInCents: 0
    selectData[0] = [
      {
        name: "Haircut",
        priceInCents: 5000,
        durationMinutes: 60,
        depositInCents: 0,
      },
    ];

    const res = await POST(makePost(validGuestBody));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: expect.stringContaining("deposit") });
  });

  /* ------------------------------------------------------------------ */
  /*  9. Happy path — guest creates booking with deposit                  */
  /* ------------------------------------------------------------------ */

  it("creates booking and processes deposit payment", async () => {
    // selectData[0] = service with deposit
    selectData[0] = [
      {
        name: "Color Service",
        priceInCents: 15000,
        durationMinutes: 90,
        depositInCents: 5000,
      },
    ];
    // selectData[1] = admin profile (for guest bookingClientId lookup)
    selectData[1] = [{ id: "admin-uuid" }];
    // selectData[2] = admin profile for email notification (no email → skips email)
    selectData[2] = [];

    const res = await POST(makePost(validGuestBody));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, bookingId: expect.anything() });

    // Booking insert should have been called
    expect(mockInsert).toHaveBeenCalled();

    // Square payment should have been called with the deposit amount
    expect(mockCreateSquarePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountInCents: 5000,
        sourceId: validGuestBody.sourceId,
        idempotencyKey: validGuestBody.idempotencyKey,
      }),
    );

    // Audit log and track event should fire
    expect(mockLogAction).toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.any(String),
      "deposit_paid_inline",
      expect.objectContaining({ amountInCents: 5000, isGuest: true }),
    );
  });

  /* ------------------------------------------------------------------ */
  /*  10. Payment failure → 402 + soft-delete booking                    */
  /* ------------------------------------------------------------------ */

  it("returns 402 and soft-deletes booking when payment fails", async () => {
    selectData[0] = [
      {
        name: "Color Service",
        priceInCents: 15000,
        durationMinutes: 90,
        depositInCents: 5000,
      },
    ];
    selectData[1] = [{ id: "admin-uuid" }];

    mockCreateSquarePayment.mockRejectedValue(new Error("Card declined"));

    const res = await POST(makePost(validGuestBody));

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Card declined" });

    // Soft-delete: update bookings set deletedAt
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });
});
