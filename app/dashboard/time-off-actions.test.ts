// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockRequireAdmin = vi.fn();
const mockTrackEvent = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn();
const mockGetSmsRecipient = vi.fn();
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup helper                                                  */
/* ------------------------------------------------------------------ */

function setupMocks(overrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (overrides) Object.assign(resolvedDb, overrides);
  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
      type: "type",
      label: "label",
      notes: "notes",
      createdAt: "createdAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      role: "role",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ type: "isNotNull", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: mockRequireAdmin,
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({
    sendSms: mockSendSms,
    getSmsRecipient: mockGetSmsRecipient,
  }));
  vi.doMock("@/emails/TimeOffDenied", () => ({
    TimeOffDenied: vi.fn(() => null),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("z", () => ({ z: { number: vi.fn() } }));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  return self;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("time-off-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    mockGetSmsRecipient.mockResolvedValue(null);
    mockGetEmailRecipient.mockResolvedValue(null);
  });

  /* ---- getPendingTimeOffRequests ---- */

  describe("getPendingTimeOffRequests", () => {
    it("throws when user is not admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      setupMocks();
      const { getPendingTimeOffRequests } = await import("./time-off-actions");
      await expect(getPendingTimeOffRequests()).rejects.toThrow("Forbidden");
    });

    it("submit time-off: returned entries have pending status (status absent or explicit)", async () => {
      vi.resetModules();
      setupMocks({
        // Rows with no status in notes (default = pending) and one explicit pending
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              staffId: "staff-1",
              staffFirstName: "Dana",
              staffLastName: "Lee",
              startDate: "2026-04-10",
              endDate: "2026-04-10",
              type: "day_off",
              label: "Personal",
              notes: null, // no status — defaults to "pending"
              createdAt: new Date("2026-03-20T10:00:00Z"),
            },
            {
              id: 2,
              staffId: "staff-2",
              staffFirstName: "Alex",
              staffLastName: "Park",
              startDate: "2026-04-15",
              endDate: "2026-04-20",
              type: "vacation",
              label: "Trip",
              notes: JSON.stringify({ status: "pending", reason: "Holiday" }),
              createdAt: new Date("2026-03-21T10:00:00Z"),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getPendingTimeOffRequests } = await import("./time-off-actions");

      const result = await getPendingTimeOffRequests();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        staffId: "staff-1",
        startDate: "2026-04-10",
        type: "day_off",
        isPartial: false,
      });
      expect(result[1]).toMatchObject({
        id: 2,
        staffId: "staff-2",
        type: "vacation",
        reason: "Holiday",
      });
    });

    it("filters out approved and denied entries — only pending is returned", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              staffId: "staff-1",
              staffFirstName: "Dana",
              staffLastName: "Lee",
              startDate: "2026-04-10",
              endDate: "2026-04-10",
              type: "day_off",
              label: null,
              notes: JSON.stringify({ status: "approved" }),
              createdAt: new Date(),
            },
            {
              id: 2,
              staffId: "staff-2",
              staffFirstName: "Alex",
              staffLastName: "Park",
              startDate: "2026-04-15",
              endDate: "2026-04-20",
              type: "vacation",
              label: null,
              notes: JSON.stringify({ status: "denied" }),
              createdAt: new Date(),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getPendingTimeOffRequests } = await import("./time-off-actions");

      const result = await getPendingTimeOffRequests();

      // Approved and denied entries are filtered out
      expect(result).toHaveLength(0);
    });
  });

  /* ---- approveTimeOffRequest ---- */

  describe("approveTimeOffRequest", () => {
    it("throws when user is not admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      setupMocks();
      const { approveTimeOffRequest } = await import("./time-off-actions");
      await expect(approveTimeOffRequest(1)).rejects.toThrow("Forbidden");
    });

    it("throws when time-off request is not found", async () => {
      vi.resetModules();
      setupMocks();
      const { approveTimeOffRequest } = await import("./time-off-actions");
      await expect(approveTimeOffRequest(999)).rejects.toThrow("Time-off request not found");
    });

    it("approve: sets status to approved in notes (blocks bookings for that date)", async () => {
      vi.resetModules();
      const mockWhere = vi.fn();
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ notes: JSON.stringify({ status: "pending", reason: "Rest day" }) }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveTimeOffRequest } = await import("./time-off-actions");

      await approveTimeOffRequest(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.stringContaining('"status":"approved"'),
        }),
      );
    });

    it("approve: preserves existing notes fields when setting approved status", async () => {
      vi.resetModules();
      const mockSet = vi.fn((_values: Record<string, unknown>) => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({
                status: "pending",
                reason: "Doctor appointment",
                partial: { startTime: "09:00", endTime: "13:00" },
              }),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveTimeOffRequest } = await import("./time-off-actions");

      await approveTimeOffRequest(2);

      const setArg = mockSet.mock.calls[0][0];
      const parsed = JSON.parse(setArg.notes as string);
      expect(parsed.status).toBe("approved");
      expect(parsed.reason).toBe("Doctor appointment");
      expect(parsed.partial).toEqual({ startTime: "09:00", endTime: "13:00" });
    });

    it("approve: overlap with existing booking is submittable — approve does not check bookings", async () => {
      // Admin can approve time-off even if the staff member has existing bookings
      // on those dates. The approve action intentionally skips a booking-conflict
      // check — that's an admin decision. Booking creation is what gets blocked
      // downstream by hasApprovedTimeOffConflict.
      vi.resetModules();
      const mockSet = vi.fn((_values: Record<string, unknown>) => ({ where: vi.fn() }));
      setupMocks({
        // Only one select call — for the time-off notes. No booking lookup.
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending", reason: "Doctor appointment" }),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveTimeOffRequest } = await import("./time-off-actions");

      // Should resolve without checking for booking conflicts
      await expect(approveTimeOffRequest(5)).resolves.toBeUndefined();
      expect(mockSet).toHaveBeenCalledOnce();
      expect(JSON.parse(mockSet.mock.calls[0][0].notes as string).status).toBe("approved");
    });

    it("approve: tracks time_off_approved event and revalidates dashboard path", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ notes: JSON.stringify({ status: "pending" }) }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveTimeOffRequest } = await import("./time-off-actions");

      await approveTimeOffRequest(3);

      expect(mockTrackEvent).toHaveBeenCalledWith("3", "time_off_approved");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    });

    it("approve: does NOT send any email or SMS to staff", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ notes: JSON.stringify({ status: "pending" }) }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveTimeOffRequest } = await import("./time-off-actions");

      await approveTimeOffRequest(1);

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockSendSms).not.toHaveBeenCalled();
    });
  });

  /* ---- denyTimeOffRequest ---- */

  describe("denyTimeOffRequest", () => {
    it("throws when user is not admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      setupMocks();
      const { denyTimeOffRequest } = await import("./time-off-actions");
      await expect(denyTimeOffRequest(1)).rejects.toThrow("Forbidden");
    });

    it("throws when time-off request is not found", async () => {
      vi.resetModules();
      setupMocks();
      const { denyTimeOffRequest } = await import("./time-off-actions");
      await expect(denyTimeOffRequest(999)).rejects.toThrow("Time-off request not found");
    });

    it("deny: sets status to denied — does NOT set approved (booking not blocked)", async () => {
      vi.resetModules();
      const mockSet = vi.fn((_values: Record<string, unknown>) => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending", reason: "Vacation" }),
              staffId: "staff-1",
              startDate: "2026-04-10",
              endDate: "2026-04-12",
              label: "Vacation",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { denyTimeOffRequest } = await import("./time-off-actions");

      await denyTimeOffRequest(1, "Short-staffed that week");

      const setArg = mockSet.mock.calls[0][0];
      const parsed = JSON.parse(setArg.notes as string);
      expect(parsed.status).toBe("denied");
      // Must NOT be approved — denied time-off does not block booking creation
      expect(parsed.status).not.toBe("approved");
      expect(parsed.deniedReason).toBe("Short-staffed that week");
    });

    it("deny: notifies staff via SMS when recipient available", async () => {
      vi.resetModules();
      mockGetSmsRecipient.mockResolvedValue({
        phone: "+15551234567",
        firstName: "Dana",
      });
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending" }),
              staffId: "staff-1",
              startDate: "2026-04-10",
              endDate: "2026-04-10",
              label: "Day off",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { denyTimeOffRequest } = await import("./time-off-actions");

      await denyTimeOffRequest(1, "We need you");

      expect(mockSendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+15551234567",
          entityType: "time_off_denied_sms",
          localId: "1",
        }),
      );
      const body = mockSendSms.mock.calls[0][0].body as string;
      expect(body).toContain("Dana");
      expect(body).toContain("denied");
    });

    it("deny: notifies staff via email when recipient available", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({
        email: "dana@example.com",
        firstName: "Dana",
      });
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending" }),
              staffId: "staff-1",
              startDate: "2026-04-10",
              endDate: "2026-04-12",
              label: "Trip",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { denyTimeOffRequest } = await import("./time-off-actions");

      await denyTimeOffRequest(1);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "dana@example.com",
          subject: "Your time-off request has been denied",
          entityType: "time_off_denied_email",
          localId: "1",
        }),
      );
    });

    it("deny: sends both SMS and email when both recipients available", async () => {
      vi.resetModules();
      mockGetSmsRecipient.mockResolvedValue({ phone: "+15550001111", firstName: "Alex" });
      mockGetEmailRecipient.mockResolvedValue({
        email: "alex@example.com",
        firstName: "Alex",
      });
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending" }),
              staffId: "staff-2",
              startDate: "2026-05-01",
              endDate: "2026-05-03",
              label: "Long weekend",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { denyTimeOffRequest } = await import("./time-off-actions");

      await denyTimeOffRequest(4, "Busy period");

      expect(mockSendSms).toHaveBeenCalledOnce();
      expect(mockSendEmail).toHaveBeenCalledOnce();
    });

    it("deny: skips SMS and email when no recipients configured (non-fatal)", async () => {
      vi.resetModules();
      mockGetSmsRecipient.mockResolvedValue(null);
      mockGetEmailRecipient.mockResolvedValue(null);
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending" }),
              staffId: "staff-3",
              startDate: "2026-05-01",
              endDate: "2026-05-01",
              label: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { denyTimeOffRequest } = await import("./time-off-actions");

      // Should not throw even when notifications can't be sent
      await expect(denyTimeOffRequest(2)).resolves.toBeUndefined();
      expect(mockSendSms).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("deny: tracks time_off_denied event and revalidates dashboard path", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              notes: JSON.stringify({ status: "pending" }),
              staffId: "staff-1",
              startDate: "2026-04-10",
              endDate: "2026-04-10",
              label: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { denyTimeOffRequest } = await import("./time-off-actions");

      await denyTimeOffRequest(7);

      expect(mockTrackEvent).toHaveBeenCalledWith("7", "time_off_denied");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    });
  });
});
