// @vitest-environment node

/**
 * inngest/functions/review-requests.test.ts
 *
 * Unit tests for the review-requests Inngest function.
 * Verifies: sending review emails for eligible bookings, skipping bookings
 * that already have a review request in sync_log, and returning 0 when
 * there are no eligible bookings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Step stub                                                           */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                        */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockIsNotificationEnabled = vi.fn().mockResolvedValue(true);
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({ businessName: "T Creative Studio" });
const mockGetPublicRemindersConfig = vi.fn().mockResolvedValue({ reviewRequestDelayHours: 24 });

// A completed booking eligible for a review request
const BOOKING_ROW = {
  bookingId: "bk1",
  clientId: "c1",
  clientEmail: "client@example.com",
  clientFirstName: "Jane",
  notifyEmail: true,
  serviceName: "Headshot Session",
};

function makeDb(selectRows: Record<string, unknown>[][]) {
  let idx = 0;

  function makeChain(rows: Record<string, unknown>[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  return { select: vi.fn(() => makeChain(selectRows[idx++] ?? [])) };
}

function setupMocks(
  selectRows: Record<string, unknown>[][],
  {
    notificationEnabled = true,
    sendEmailResult = true,
  }: { notificationEnabled?: boolean; sendEmailResult?: boolean } = {},
) {
  const db = makeDb(selectRows);
  mockIsNotificationEnabled.mockResolvedValue(notificationEnabled);
  mockSendEmail.mockResolvedValue(sendEmailResult);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      completedAt: "completedAt",
    },
    profiles: { id: "id", email: "email", firstName: "firstName", notifyEmail: "notifyEmail" },
    services: { id: "id", name: "name" },
    syncLog: { id: "id", entityType: "entityType", localId: "localId", status: "status" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
  }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/notification-preferences", () => ({
    isNotificationEnabled: mockIsNotificationEnabled,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
    getPublicRemindersConfig: mockGetPublicRemindersConfig,
  }));
  vi.doMock("@/emails/ReviewRequest", () => ({
    ReviewRequest: vi.fn(() => ({ type: "div" })),
  }));
  vi.doMock("@/lib/site-config", () => ({ SITE_URL: "https://example.com" }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/review-requests");
  const fn = (mod.reviewRequests as any)?.handler ?? mod.reviewRequests;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("review-requests", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sends review request email for an eligible completed booking", async () => {
    // Query 1: bookings join; Query 2: sync_log dedup check (empty = not sent yet)
    setupMocks([[BOOKING_ROW], []]);

    const result = await runHandler();

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe("client@example.com");
    expect(args.subject).toContain("Headshot Session");
    expect(result).toEqual({ matched: 1, sent: 1, failed: 0 });
  });

  it("skips booking that already has a review request in sync_log", async () => {
    // Query 1: bookings; Query 2: sync_log returns existing row → dedup hit
    setupMocks([[BOOKING_ROW], [{ id: "sl1" }]]);

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 0 });
  });

  it("returns 0 sent when there are no eligible bookings", async () => {
    setupMocks([[]]); // empty booking query

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 0, sent: 0, failed: 0 });
  });

  it("skips when client has notifications disabled", async () => {
    setupMocks([[BOOKING_ROW], []], { notificationEnabled: false });

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 0 });
  });

  it("counts as failed when sendEmail returns false", async () => {
    setupMocks([[BOOKING_ROW], []], { sendEmailResult: false });

    const result = await runHandler();

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 1 });
  });
});
