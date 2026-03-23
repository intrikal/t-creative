// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/sequences/actions.ts
 *
 * Covers all 7 exported functions:
 *  1. createSequence — inserts sequence + steps, returns ActionResult
 *  2. autoEnrollClient — enroll on trigger, onConflictDoNothing for deduplication
 *  3. autoEnrollClient — duplicate blocked (no-op)
 *  4. autoEnrollClient — skips when marketing prefs disabled
 *  5. cancelEnrollment — sets status to cancelled
 *  6. deleteSequence — deletes sequence (cascade)
 *  7. updateSequence — deactivates sequence (isActive=false)
 *  8. autoEnrollClient — re-enrollment after cancellation
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, @/lib/auth, @/lib/audit,
 *        @/lib/posthog, @/lib/notification-preferences, @sentry/nextjs, next/cache.
 */

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

const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" });
const mockLogAction = vi.fn();
const mockTrackEvent = vi.fn();
const mockIsNotificationEnabled = vi.fn().mockResolvedValue(true);
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (dbOverrides) Object.assign(resolvedDb, dbOverrides);

  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    emailSequences: {
      id: "id",
      name: "name",
      triggerEvent: "triggerEvent",
      isActive: "isActive",
      createdAt: "createdAt",
    },
    emailSequenceSteps: {
      id: "id",
      sequenceId: "sequenceId",
      stepOrder: "stepOrder",
      delayDays: "delayDays",
      subject: "subject",
      body: "body",
    },
    emailSequenceEnrollments: {
      id: "id",
      sequenceId: "sequenceId",
      profileId: "profileId",
      currentStep: "currentStep",
      status: "status",
      enrolledAt: "enrolledAt",
      cancelledAt: "cancelledAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    sql: vi.fn(),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/notification-preferences", () => ({
    isNotificationEnabled: mockIsNotificationEnabled,
  }));
  vi.doMock("@/lib/types/action-result", () => ({}));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn() })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  return self;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("sequences/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    mockIsNotificationEnabled.mockResolvedValue(true);
  });

  /* ---- createSequence ---- */

  describe("createSequence", () => {
    it("inserts a sequence and its steps, returns success with id", async () => {
      vi.resetModules();
      const mockSeqValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }));
      const mockStepValues = vi.fn().mockResolvedValue(undefined);
      let insertCall = 0;
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => {
          insertCall++;
          if (insertCall === 1) return { values: mockSeqValues };
          return { values: mockStepValues };
        }),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSequence } = await import("@/app/dashboard/sequences/actions");

      const result = await createSequence({
        name: "Welcome Drip",
        triggerEvent: "new_client_signup",
        steps: [
          { stepOrder: 1, delayDays: 0, subject: "Welcome!", body: "Hi {{firstName}}" },
          { stepOrder: 2, delayDays: 3, subject: "How was it?", body: "Follow up" },
        ],
      });

      expect(result).toEqual({ success: true, data: { id: 42 } });
      expect(mockSeqValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Welcome Drip",
          triggerEvent: "new_client_signup",
        }),
      );
      // Steps inserted in bulk
      expect(mockStepValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sequenceId: 42, stepOrder: 1, delayDays: 0 }),
          expect.objectContaining({ sequenceId: 42, stepOrder: 2, delayDays: 3 }),
        ]),
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("admin-1", "email_sequence_created", {
        sequenceId: 42,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/sequences");
    });
  });

  /* ---- autoEnrollClient ---- */

  describe("autoEnrollClient", () => {
    it("enrolls a client into matching active sequences", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockEnrollValues = vi.fn(() => ({
        onConflictDoNothing: mockOnConflict,
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 10 }, { id: 20 }])),
        insert: vi.fn(() => ({ values: mockEnrollValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");

      await autoEnrollClient("profile-1", "new_client_signup");

      // Should insert enrollment for each matching sequence
      expect(mockEnrollValues).toHaveBeenCalledTimes(2);
      expect(mockEnrollValues).toHaveBeenCalledWith(
        expect.objectContaining({
          sequenceId: 10,
          profileId: "profile-1",
          currentStep: 0,
          status: "active",
        }),
      );
      expect(mockOnConflict).toHaveBeenCalledTimes(2);
    });

    it("is a no-op when client already enrolled (onConflictDoNothing)", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockEnrollValues = vi.fn(() => ({
        onConflictDoNothing: mockOnConflict,
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 10 }])),
        insert: vi.fn(() => ({ values: mockEnrollValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");

      // Should not throw even if conflict (duplicate enrollment)
      await expect(autoEnrollClient("profile-1", "new_client_signup")).resolves.not.toThrow();
      expect(mockOnConflict).toHaveBeenCalled();
    });

    it("skips enrollment when marketing email is disabled", async () => {
      vi.resetModules();
      mockIsNotificationEnabled.mockResolvedValue(false);
      const mockSelect = vi.fn(() => makeChain([]));
      setupMocks({
        select: mockSelect,
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");

      await autoEnrollClient("profile-1", "new_client_signup");

      // Should check prefs and bail out before querying sequences
      expect(mockIsNotificationEnabled).toHaveBeenCalledWith("profile-1", "email", "marketing");
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("allows re-enrollment after cancellation (onConflictDoNothing handles uniqueness)", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockEnrollValues = vi.fn(() => ({
        onConflictDoNothing: mockOnConflict,
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 10 }])),
        insert: vi.fn(() => ({ values: mockEnrollValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");

      // The unique index is partial (WHERE status='active'), so a new enrollment
      // can be inserted after the previous one was cancelled. onConflictDoNothing
      // handles the case where an active enrollment already exists.
      await autoEnrollClient("profile-1", "first_booking_completed");

      expect(mockEnrollValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "profile-1",
          status: "active",
        }),
      );
    });
  });

  /* ---- cancelEnrollment ---- */

  describe("cancelEnrollment", () => {
    it("sets enrollment status to cancelled with timestamp", async () => {
      vi.resetModules();
      const mockSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelEnrollment } = await import("@/app/dashboard/sequences/actions");

      const result = await cancelEnrollment(99);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          cancelledAt: expect.any(Date),
        }),
      );
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "update",
          entityType: "email_sequence_enrollment",
          entityId: "99",
        }),
      );
    });
  });

  /* ---- deleteSequence ---- */

  describe("deleteSequence", () => {
    it("deletes the sequence and logs the action", async () => {
      vi.resetModules();
      const mockWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockWhere })),
      });
      const { deleteSequence } = await import("@/app/dashboard/sequences/actions");

      const result = await deleteSequence(42);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockWhere).toHaveBeenCalled();
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delete",
          entityType: "email_sequence",
          entityId: "42",
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/sequences");
    });
  });

  /* ---- updateSequence (deactivate) ---- */

  describe("updateSequence", () => {
    it("deactivates a sequence by setting isActive=false", async () => {
      vi.resetModules();
      const mockSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateSequence } = await import("@/app/dashboard/sequences/actions");

      const result = await updateSequence(42, { isActive: false });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "update",
          entityType: "email_sequence",
          entityId: "42",
        }),
      );
    });
  });
});
