// @vitest-environment node

/**
 * inngest/functions/birthdays.test.ts
 *
 * Unit tests for the birthdays Inngest function.
 * Verifies: birthday email sent for matching clients, skipped when marketing
 * notifications disabled, returns 0 when no birthdays today, and email
 * failures are counted but do not throw.
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
const mockGetPublicLoyaltyConfig = vi.fn().mockResolvedValue({
  birthdayDiscountPercent: 20,
  birthdayPromoExpiryDays: 30,
});

const BIRTHDAY_PROFILE = {
  id: "client-1",
  email: "jane@example.com",
  firstName: "Jane",
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

  return {
    select: vi.fn(() => makeChain(selectRows[idx++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "promo-1" }]),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
  };
}

function setupMocks(
  selectRows: Record<string, unknown>[][],
  opts: { notificationEnabled?: boolean; sendEmailResult?: boolean } = {},
) {
  const { notificationEnabled = true, sendEmailResult = true } = opts;
  const db = makeDb(selectRows);
  mockIsNotificationEnabled.mockResolvedValue(notificationEnabled);
  mockSendEmail.mockResolvedValue(sendEmailResult);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      isActive: "isActive",
      notifyEmail: "notifyEmail",
      onboardingData: "onboardingData",
    },
    promotions: {
      id: "id",
      code: "code",
      discountType: "discountType",
      discountValue: "discountValue",
      description: "description",
      appliesTo: "appliesTo",
      maxUses: "maxUses",
      startsAt: "startsAt",
      endsAt: "endsAt",
    },
    syncLog: {
      id: "id",
      entityType: "entityType",
      localId: "localId",
      status: "status",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/notification-preferences", () => ({
    isNotificationEnabled: mockIsNotificationEnabled,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
    getPublicLoyaltyConfig: mockGetPublicLoyaltyConfig,
  }));
  vi.doMock("@/emails/BirthdayGreeting", () => ({
    BirthdayGreeting: vi.fn(() => ({ type: "div" })),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/birthdays");
  const fn = (mod.birthdays as any)?.handler ?? mod.birthdays;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("birthdays", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sends birthday greeting email to client with birthday today", async () => {
    // Query 1: birthday profiles; Query 2: syncLog dedup (empty); Query 3: promo dedup (empty)
    setupMocks([[BIRTHDAY_PROFILE], [], []]);

    const result = await runHandler();

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe("jane@example.com");
    expect(args.subject).toContain("Jane");
    expect(args.entityType).toBe("birthday_greeting");
    expect(result).toEqual({ matched: 1, sent: 1, failed: 0 });
  });

  it("skips client when birthday_promo notification is disabled (notifyMarketing=false)", async () => {
    setupMocks([[BIRTHDAY_PROFILE], [], []], { notificationEnabled: false });

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 0 });
  });

  it("returns 0 sent when there are no birthdays today", async () => {
    setupMocks([[]]); // empty profiles query

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 0, sent: 0, failed: 0 });
  });

  it("counts failure when sendEmail returns false, does not throw", async () => {
    setupMocks([[BIRTHDAY_PROFILE], [], []], { sendEmailResult: false });

    const result = await runHandler();

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 1 });
  });

  it("skips client that already received a birthday email this year (dedup)", async () => {
    // Query 1: birthday profiles; Query 2: syncLog returns existing row
    setupMocks([[BIRTHDAY_PROFILE], [{ id: "sl-1" }]]);

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 0 });
  });

  it("skips client with no email address", async () => {
    const noEmail = { ...BIRTHDAY_PROFILE, email: null };
    setupMocks([[noEmail], []]);

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ matched: 1, sent: 0, failed: 0 });
  });
});
