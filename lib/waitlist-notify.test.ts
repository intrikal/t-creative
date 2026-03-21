// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the waitlist notification module.
 *
 * Covers:
 *  - notifyNextWaitlistEntry: sends email + updates row when entry found,
 *    no-op on empty waitlist, no-op on disabled email preference,
 *    resolves even if notification insert fails
 *  - notifyWaitlistForCancelledBooking: looks up cancelled booking and
 *    notifies next entry, no-op on missing booking, doesn't throw on errors
 *
 * Mocks: db (select/insert/update chains), sendEmail, WaitlistNotification
 * component, drizzle-orm operators.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockSendEmail: captures email send calls
const mockSendEmail = vi.fn();
// mockDbInsertValues: captures notification row inserts
const mockDbInsertValues = vi.fn();
// mockDbUpdateSetWhere: captures waitlist row status updates
const mockDbUpdateSetWhere = vi.fn();

/** Builds a thenable chain usable for any Drizzle select query shape. */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.leftJoin as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

const mockDbSelect = vi.fn();

// Mock the database so tests don't need a real Postgres connection
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: vi.fn().mockReturnValue({ values: mockDbInsertValues }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  bookings: {},
  notifications: {},
  profiles: {},
  services: {},
  waitlist: {},
}));

// Mock Resend so tests don't send real emails
vi.mock("@/lib/resend", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock the email template component — we only care that sendEmail is called, not the HTML
vi.mock("@/emails/WaitlistNotification", () => ({
  WaitlistNotification: vi.fn().mockReturnValue(null),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/waitlist-notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbUpdateSetWhere.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(true);
  });

  describe("notifyNextWaitlistEntry", () => {
    it("sends email and updates waitlist row when an entry is found", async () => {
      mockDbSelect.mockReturnValue(
        makeSelectChain([
          {
            id: 7,
            clientId: "client-uuid",
            clientEmail: "client@example.com",
            clientFirstName: "Jane",
            notifyEmail: true,
            serviceName: "Lash Full Set",
          },
        ]),
      );

      const { notifyNextWaitlistEntry } = await import("./waitlist-notify");
      await notifyNextWaitlistEntry({
        serviceId: 1,
        offeredSlotStartsAt: new Date("2026-04-01T10:00:00Z"),
        offeredStaffId: "staff-uuid",
      });

      expect(mockDbUpdateSetWhere).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          entityType: "waitlist_notification",
          localId: "7",
        }),
      );
    });

    it("does nothing when waitlist is empty", async () => {
      mockDbSelect.mockReturnValue(makeSelectChain([]));

      const { notifyNextWaitlistEntry } = await import("./waitlist-notify");
      await notifyNextWaitlistEntry({
        serviceId: 1,
        offeredSlotStartsAt: new Date("2026-04-01T10:00:00Z"),
        offeredStaffId: null,
      });

      expect(mockDbUpdateSetWhere).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does nothing when entry has no email (notifyEmail disabled)", async () => {
      mockDbSelect.mockReturnValue(
        makeSelectChain([
          {
            id: 8,
            clientId: "client-uuid",
            clientEmail: null,
            clientFirstName: "Bob",
            notifyEmail: false,
            serviceName: "Brow Tint",
          },
        ]),
      );

      const { notifyNextWaitlistEntry } = await import("./waitlist-notify");
      await notifyNextWaitlistEntry({
        serviceId: 2,
        offeredSlotStartsAt: new Date("2026-04-02T14:00:00Z"),
        offeredStaffId: null,
      });

      expect(mockDbUpdateSetWhere).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("still resolves if notification insert fails (non-fatal)", async () => {
      mockDbSelect.mockReturnValue(
        makeSelectChain([
          {
            id: 9,
            clientId: "client-uuid",
            clientEmail: "client@example.com",
            clientFirstName: "Ana",
            notifyEmail: true,
            serviceName: "Lash Lift",
          },
        ]),
      );
      mockDbInsertValues.mockRejectedValue(new Error("DB error"));

      const { notifyNextWaitlistEntry } = await import("./waitlist-notify");
      await expect(
        notifyNextWaitlistEntry({
          serviceId: 3,
          offeredSlotStartsAt: new Date("2026-04-03T09:00:00Z"),
          offeredStaffId: null,
        }),
      ).resolves.toBeUndefined();

      // Email was still sent despite insert failure
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe("notifyWaitlistForCancelledBooking", () => {
    it("looks up the cancelled booking and notifies the next waitlist entry", async () => {
      mockDbSelect
        .mockReturnValueOnce(
          makeSelectChain([
            { serviceId: 1, startsAt: new Date("2026-04-01T10:00:00Z"), staffId: "staff-uuid" },
          ]),
        )
        .mockReturnValue(
          makeSelectChain([
            {
              id: 7,
              clientId: "client-uuid",
              clientEmail: "client@example.com",
              clientFirstName: "Jane",
              notifyEmail: true,
              serviceName: "Lash Full Set",
            },
          ]),
        );

      const { notifyWaitlistForCancelledBooking } = await import("./waitlist-notify");
      await notifyWaitlistForCancelledBooking(42);

      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("does nothing when the cancelled booking is not found", async () => {
      mockDbSelect.mockReturnValue(makeSelectChain([]));

      const { notifyWaitlistForCancelledBooking } = await import("./waitlist-notify");
      await notifyWaitlistForCancelledBooking(999);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does not throw when an error occurs (non-fatal)", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB connection lost")),
        }),
      });

      const { notifyWaitlistForCancelledBooking } = await import("./waitlist-notify");
      await expect(notifyWaitlistForCancelledBooking(1)).resolves.toBeUndefined();
    });
  });
});
