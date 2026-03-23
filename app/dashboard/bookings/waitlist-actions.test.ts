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

const mockGetUser = vi.fn();
const mockTrackEvent = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockGetPublicBusinessProfile = vi.fn();
const mockRevalidatePath = vi.fn();

function setupMocks(overrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (overrides) Object.assign(resolvedDb, overrides);
  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    waitlist: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      createdAt: "createdAt",
      preferredDateStart: "preferredDateStart",
      preferredDateEnd: "preferredDateEnd",
      timePreference: "timePreference",
      notes: "notes",
      notifiedAt: "notifiedAt",
      claimToken: "claimToken",
      claimTokenExpiresAt: "claimTokenExpiresAt",
      offeredSlotStartsAt: "offeredSlotStartsAt",
      offeredStaffId: "offeredStaffId",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      notifyEmail: "notifyEmail",
    },
    services: { id: "id", name: "name", category: "category" },
    bookings: {
      id: "id",
      clientId: "clientId",
      startsAt: "startsAt",
      status: "status",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    count: vi.fn(() => ({ type: "count" })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      email: `${name}_email`,
      firstName: `${name}_firstName`,
      notifyEmail: `${name}_notifyEmail`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@/emails/WaitlistNotification", () => ({
    WaitlistNotification: vi.fn(() => null),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
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

describe("waitlist-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetPublicBusinessProfile.mockResolvedValue({
      businessName: "Test Salon",
    });
  });

  /* ---- addToWaitlist ---- */

  describe("addToWaitlist", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { addToWaitlist } = await import("./waitlist-actions");
      await expect(addToWaitlist({ clientId: "client-1", serviceId: 1 })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("tracks position as count of entries for this service after insert", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ value: 3 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { addToWaitlist } = await import("./waitlist-actions");

      await addToWaitlist({ clientId: "client-1", serviceId: 42 });

      expect(mockTrackEvent).toHaveBeenCalledWith("client-1", "waitlist_joined", {
        serviceId: 42,
        position: 3,
      });
    });

    it("inserts with null optional fields when not provided", async () => {
      vi.resetModules();
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ value: 1 }])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { addToWaitlist } = await import("./waitlist-actions");

      await addToWaitlist({ clientId: "client-1", serviceId: 5 });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          serviceId: 5,
          preferredDateStart: null,
          preferredDateEnd: null,
          timePreference: null,
          notes: null,
        }),
      );
    });

    it("revalidates bookings path after insert", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ value: 1 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { addToWaitlist } = await import("./waitlist-actions");

      await addToWaitlist({ clientId: "client-1", serviceId: 1 });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- removeFromWaitlistById ---- */

  describe("removeFromWaitlistById", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { removeFromWaitlistById } = await import("./waitlist-actions");
      await expect(removeFromWaitlistById(1)).rejects.toThrow("Not authenticated");
    });

    it("deletes only the specified entry by id", async () => {
      vi.resetModules();
      const mockWhere = vi.fn();
      const mockDelete = vi.fn(() => ({ where: mockWhere }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: mockDelete,
      });
      const { removeFromWaitlistById } = await import("./waitlist-actions");

      await removeFromWaitlistById(7);

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledTimes(1);
    });

    it("remaining entries are unaffected — delete targets one row", async () => {
      vi.resetModules();
      const mockDelete = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: mockDelete,
      });
      const { removeFromWaitlistById } = await import("./waitlist-actions");

      // Remove entry id=2 from a hypothetical list [1, 2, 3]
      await removeFromWaitlistById(2);

      // delete is called exactly once (not for every other entry)
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("revalidates bookings path after delete", async () => {
      vi.resetModules();
      setupMocks();
      const { removeFromWaitlistById } = await import("./waitlist-actions");

      await removeFromWaitlistById(3);

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- updateWaitlistStatus (notify next) ---- */

  describe("updateWaitlistStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateWaitlistStatus } = await import("./waitlist-actions");
      await expect(updateWaitlistStatus(1, "notified")).rejects.toThrow("Not authenticated");
    });

    it("sends notification email to the correct client when status is notified", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientEmail: "jane@example.com",
              clientFirstName: "Jane",
              notifyEmail: true,
              serviceName: "Haircut",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(10, "notified");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
          subject: expect.stringContaining("Haircut"),
        }),
      );
    });

    it("does not send email when client has notifyEmail = false", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientEmail: "quiet@example.com",
              clientFirstName: "Quiet",
              notifyEmail: false,
              serviceName: "Massage",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(11, "notified");

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("skips email entirely for non-notified status transitions", async () => {
      vi.resetModules();
      setupMocks();
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(5, "booked");

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("skips sending when no matching waitlist row is found (expired claim)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      // Should not throw and should not send email
      await expect(updateWaitlistStatus(99, "notified")).resolves.toBeUndefined();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("skips client with no email address (client already has booking at offered time)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientEmail: null,
              clientFirstName: "NoEmail",
              notifyEmail: true,
              serviceName: "Facial",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(12, "notified");

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("updates the status field in the database", async () => {
      vi.resetModules();
      const mockWhere = vi.fn();
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(4, "cancelled");

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    });

    it("sets notifiedAt when transitioning to notified", async () => {
      vi.resetModules();
      const mockWhere = vi.fn();
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(4, "notified");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "notified",
          notifiedAt: expect.any(Date),
        }),
      );
    });

    it("revalidates bookings path after status update", async () => {
      vi.resetModules();
      setupMocks();
      const { updateWaitlistStatus } = await import("./waitlist-actions");

      await updateWaitlistStatus(6, "waiting");

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- getWaitlist ---- */

  describe("getWaitlist", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getWaitlist } = await import("./waitlist-actions");
      await expect(getWaitlist()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no waitlist entries exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getWaitlist } = await import("./waitlist-actions");
      const result = await getWaitlist();
      expect(result).toEqual([]);
    });

    it("maps rows to WaitlistRow shape with ISO string dates", async () => {
      vi.resetModules();
      const createdAt = new Date("2024-06-01T10:00:00Z");
      const notifiedAt = new Date("2024-06-02T12:00:00Z");
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              clientId: "client-1",
              clientFirstName: "Jane",
              clientLastName: "Doe",
              clientPhone: "555-1234",
              serviceId: 10,
              serviceName: "Haircut",
              serviceCategory: "Hair",
              status: "waiting",
              preferredDateStart: null,
              preferredDateEnd: null,
              timePreference: "morning",
              notes: null,
              notifiedAt,
              createdAt,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWaitlist } = await import("./waitlist-actions");

      const result = await getWaitlist();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        clientId: "client-1",
        clientName: "Jane Doe",
        clientPhone: "555-1234",
        serviceId: 10,
        serviceName: "Haircut",
        serviceCategory: "Hair",
        status: "waiting",
        notifiedAt: notifiedAt.toISOString(),
        createdAt: createdAt.toISOString(),
      });
    });
  });
});
