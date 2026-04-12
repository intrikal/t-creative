/**
 * Tests for POST /api/webhooks/twilio — inbound SMS booking management.
 *
 * Covers:
 *  - Auth: invalid Twilio signature → 403
 *  - "C" reply → confirms next pending booking, returns TwiML success
 *  - "CONFIRM" reply → same as "C"
 *  - "X" reply → cancels next booking, returns TwiML cancellation
 *  - "CANCEL" reply → same as "X"
 *  - Unrecognized keyword → TwiML help message
 *  - Unknown phone number → TwiML "contact us" message
 *  - No upcoming booking → TwiML "no booking found" message
 *  - Webhook event stored in webhook_events table
 *  - Sync log entry created for each action
 *
 * Mocks: twilio.validateRequest, db, logAction, env, Sentry
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockValidateRequest = vi.fn();
const mockLogAction = vi.fn();
const mockCaptureException = vi.fn();
const mockDbSelect = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();

/** Thenable chain for db.select() — supports from/where/innerJoin/orderBy/limit */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.limit as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

/** Thenable insert chain — supports values/returning; values() is also thenable for bare inserts */
function makeInsertChain(returningResult: unknown[] = [{ id: 1 }]) {
  const resolved = Promise.resolve([]);
  return {
    values: (...args: unknown[]) => {
      mockInsertValues(...args);
      return {
        returning: vi.fn().mockReturnValue(returningResult),
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      };
    },
  };
}

/** Update chain — supports set/where */
function makeUpdateChain() {
  return {
    set: (...args: unknown[]) => {
      mockUpdateSet(...args);
      return { where: vi.fn().mockResolvedValue(undefined) };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Shared mock registrations                                           */
/* ------------------------------------------------------------------ */

const schemaMock = {
  bookings: {
    id: "id",
    clientId: "clientId",
    serviceId: "serviceId",
    startsAt: "startsAt",
    status: "status",
    deletedAt: "deletedAt",
    confirmedAt: "confirmedAt",
    cancelledAt: "cancelledAt",
    cancellationReason: "cancellationReason",
    staffId: "staffId",
  },
  profiles: { id: "id", firstName: "firstName", phone: "phone" },
  services: { id: "id", name: "name" },
  webhookEvents: {
    id: "id",
    provider: "provider",
    externalEventId: "externalEventId",
    eventType: "eventType",
    payload: "payload",
    isProcessed: "isProcessed",
    attempts: "attempts",
    errorMessage: "errorMessage",
    processedAt: "processedAt",
  },
  syncLog: {},
};

const drizzleMock = {
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((_col: unknown, val: unknown) => val),
  gte: vi.fn((_col: unknown, val: unknown) => val),
  inArray: vi.fn((_col: unknown, vals: unknown) => vals),
  isNull: vi.fn((_col: unknown) => null),
  asc: vi.fn((_col: unknown) => _col),
};

function makeDbMock() {
  return {
    db: {
      select: (...args: unknown[]) => mockDbSelect(...args),
      insert: () => makeInsertChain(),
      update: () => makeUpdateChain(),
    },
  };
}

vi.mock("twilio/lib/webhooks/webhooks", () => ({
  validateRequest: (...args: unknown[]) => mockValidateRequest(...args),
}));

vi.mock("@/lib/env", () => ({
  env: { TWILIO_AUTH_TOKEN: "test-auth-token" },
}));

vi.mock("@/lib/audit", () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock("@/db/schema", () => schemaMock);
vi.mock("drizzle-orm", () => drizzleMock);

vi.mock("date-fns", () => ({
  format: vi.fn(() => "Monday, May 1 at 10:00 AM"),
}));

vi.mock("@/db", () => makeDbMock());

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRequest(params: Record<string, string>, sig = "valid-sig"): Request {
  const encoded = new URLSearchParams(params).toString();
  return new Request("https://example.com/api/webhooks/twilio", {
    method: "POST",
    body: encoded,
    headers: { "x-twilio-signature": sig },
  });
}

function smsParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    MessageSid: "SM_test_123",
    From: "+15551234567",
    Body: "C",
    ...overrides,
  };
}

const MOCK_CLIENT = { id: "client-1", firstName: "Jane" };
const MOCK_BOOKING = {
  id: 42,
  startsAt: new Date("2026-05-01T10:00:00"),
  status: "pending",
  serviceName: "Classic Lash Set",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("POST /api/webhooks/twilio", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: valid Twilio signature
    mockValidateRequest.mockReturnValue(true);
    mockLogAction.mockResolvedValue(undefined);

    // Default: client found on first phone lookup, booking found
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_CLIENT]))
      .mockReturnValueOnce(makeSelectChain([MOCK_BOOKING]));

    vi.resetModules();

    vi.doMock("twilio/lib/webhooks/webhooks", () => ({
      validateRequest: (...args: unknown[]) => mockValidateRequest(...args),
    }));
    vi.doMock("@/lib/env", () => ({
      env: { TWILIO_AUTH_TOKEN: "test-auth-token" },
    }));
    vi.doMock("@/lib/audit", () => ({
      logAction: (...args: unknown[]) => mockLogAction(...args),
    }));
    vi.doMock("@sentry/nextjs", () => ({
      captureException: (...args: unknown[]) => mockCaptureException(...args),
    }));
    vi.doMock("@/db/schema", () => schemaMock);
    vi.doMock("drizzle-orm", () => drizzleMock);
    vi.doMock("date-fns", () => ({
      format: vi.fn(() => "Monday, May 1 at 10:00 AM"),
    }));
    vi.doMock("@/db", () => makeDbMock());

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ---------- Signature verification ---------- */

  it("returns 403 when Twilio signature is invalid", async () => {
    mockValidateRequest.mockReturnValue(false);

    const res = await POST(makeRequest(smsParams()));

    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe("Invalid signature");
  });

  /* ---------- Confirm commands ---------- */

  it("confirms booking when client replies 'C'", async () => {
    const res = await POST(makeRequest(smsParams({ Body: "C" })));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/xml");

    const xml = await res.text();
    expect(xml).toContain("Confirmed!");
    expect(xml).toContain("Classic Lash Set");
    expect(xml).toContain("Monday, May 1 at 10:00 AM");
  });

  it("confirms booking when client replies 'CONFIRM'", async () => {
    const res = await POST(makeRequest(smsParams({ Body: "CONFIRM" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("Confirmed!");
  });

  /* ---------- Cancel commands ---------- */

  it("cancels booking when client replies 'X'", async () => {
    const res = await POST(makeRequest(smsParams({ Body: "X" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("has been cancelled");
    expect(xml).toContain("Classic Lash Set");
  });

  it("cancels booking when client replies 'CANCEL'", async () => {
    const res = await POST(makeRequest(smsParams({ Body: "CANCEL" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("has been cancelled");
  });

  /* ---------- Unrecognized keyword ---------- */

  it("returns help message for unrecognized keyword", async () => {
    const res = await POST(makeRequest(smsParams({ Body: "HELLO" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("Reply C to confirm or X to cancel");
  });

  /* ---------- Unknown phone number ---------- */

  it("returns 'contact us' message for unknown phone number", async () => {
    // Both phone lookups return empty (normalized + 10-digit)
    mockDbSelect.mockReset();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))  // normalized phone lookup
      .mockReturnValueOnce(makeSelectChain([])); // 10-digit phone lookup

    const res = await POST(makeRequest(smsParams({ From: "+19999999999" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("couldn't find an account");
    expect(xml).toContain("contact us");
  });

  /* ---------- No upcoming booking ---------- */

  it("returns 'no booking' message when no upcoming booking found for confirm", async () => {
    mockDbSelect.mockReset();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_CLIENT]))  // client found
      .mockReturnValueOnce(makeSelectChain([]));             // no booking

    const res = await POST(makeRequest(smsParams({ Body: "C" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("don't have any upcoming bookings to confirm");
  });

  it("returns 'no booking' message when no upcoming booking found for cancel", async () => {
    mockDbSelect.mockReset();
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_CLIENT]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await POST(makeRequest(smsParams({ Body: "X" })));

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("don't have any upcoming bookings to cancel");
  });

  /* ---------- Webhook event stored ---------- */

  it("stores the inbound SMS event in webhook_events", async () => {
    await POST(makeRequest(smsParams()));

    // First insert call should be the webhook event
    const webhookInsert = mockInsertValues.mock.calls[0]?.[0];
    expect(webhookInsert).toMatchObject({
      provider: "twilio",
      eventType: "inbound_sms",
      externalEventId: "SM_test_123",
      isProcessed: false,
      attempts: 1,
    });
  });

  /* ---------- Sync log entry ---------- */

  it("creates a sync log entry for a successful confirmation", async () => {
    await POST(makeRequest(smsParams({ Body: "C" })));

    // Second insert call should be the sync log
    const syncLogInsert = mockInsertValues.mock.calls[1]?.[0];
    expect(syncLogInsert).toMatchObject({
      provider: "twilio",
      direction: "inbound",
      status: "success",
      entityType: "inbound_sms",
      remoteId: "SM_test_123",
    });
    expect(syncLogInsert.message).toContain("Confirmed booking #42");
  });

  it("creates a sync log entry with 'skipped' status for unrecognized command", async () => {
    await POST(makeRequest(smsParams({ Body: "HELLO" })));

    const syncLogInsert = mockInsertValues.mock.calls[1]?.[0];
    expect(syncLogInsert).toMatchObject({
      provider: "twilio",
      direction: "inbound",
      status: "skipped",
    });
  });

  /* ---------- Audit log ---------- */

  it("logs an audit entry for confirmed bookings", async () => {
    await POST(makeRequest(smsParams({ Body: "C" })));

    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "client-1",
        action: "status_change",
        entityType: "booking",
        entityId: "42",
      }),
    );
  });
});
