// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

// Returns an awaitable, chainable object that mimics Drizzle ORM's query builder.
// Every builder method (from, where, join, etc.) returns itself so any chain resolves to `rows`.
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    groupBy: () => chain,
    as: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

// vi.fn(): creates a mock function that records how it was called.
// mockGetUser simulates Supabase auth -- tests set its return value to control authentication state.
const mockGetUser = vi.fn();
// mockRequireAdmin simulates the lib/auth requireAdmin() guard for admin-only actions.
const mockRequireAdmin = vi.fn();
const mockRevalidatePath = vi.fn();
// Captures email sends so tests can verify enrollment confirmation emails are triggered.
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
// Controls which email recipient (if any) is resolved for sending enrollment confirmations.
const mockGetEmailRecipient = vi.fn().mockResolvedValue(null);

// Registers vi.doMock() calls for all external dependencies (DB, auth, email, etc.)
// so the imported server actions run against fakes instead of real services.
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    trainingPrograms: {
      id: "id",
      name: "name",
      slug: "slug",
      category: "category",
      priceInCents: "priceInCents",
      description: "description",
      isActive: "isActive",
      maxStudents: "maxStudents",
      sortOrder: "sortOrder",
      updatedAt: "updatedAt",
    },
    trainingSessions: {
      id: "id",
      programId: "programId",
      startsAt: "startsAt",
      status: "status",
      isWaitlistOpen: "isWaitlistOpen",
      notes: "notes",
      location: "location",
    },
    trainingModules: {
      id: "id",
      programId: "programId",
      name: "name",
      description: "description",
      sortOrder: "sortOrder",
    },
    trainingLessons: {
      id: "id",
      moduleId: "moduleId",
      title: "title",
      content: "content",
      resourceUrl: "resourceUrl",
      durationMinutes: "durationMinutes",
      sortOrder: "sortOrder",
    },
    enrollments: {
      id: "id",
      clientId: "clientId",
      programId: "programId",
      sessionId: "sessionId",
      status: "status",
      enrolledAt: "enrolledAt",
      sessionsCompleted: "sessionsCompleted",
      amountPaidInCents: "amountPaidInCents",
      isPaid: "isPaid",
      completedAt: "completedAt",
      progressPercent: "progressPercent",
    },
    certificates: {
      id: "id",
      enrollmentId: "enrollmentId",
      programId: "programId",
      clientId: "clientId",
      issuedAt: "issuedAt",
    },
    sessionAttendance: {
      id: "id",
      sessionId: "sessionId",
      enrollmentId: "enrollmentId",
      attended: "attended",
      notes: "notes",
    },
    lessonCompletions: {
      id: "id",
      lessonId: "lessonId",
      profileId: "profileId",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      role: "role",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath, updateTag: vi.fn() }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: mockGetUser,
    requireAdmin: mockRequireAdmin,
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/emails/EnrollmentConfirmation", () => ({
    EnrollmentConfirmation: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("training/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1", email: "test@test.com" });
    mockRequireAdmin.mockResolvedValue({ id: "user-1", email: "test@test.com" });
    mockGetEmailRecipient.mockResolvedValue(null);
  });

  /* ---- getPrograms ---- */

  describe("getPrograms", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { getPrograms } = await import("./actions");
      await expect(getPrograms()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no programs exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getPrograms } = await import("./actions");
      const result = await getPrograms();
      expect(result).toEqual([]);
    });

    it("maps rows to ProgramRow shape with defaults", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // programs query
            return makeChain([
              {
                id: 1,
                name: "Lash Extensions",
                category: "lash",
                priceInCents: 50000,
                description: "A great course",
                isActive: true,
                maxStudents: 8,
              },
            ]);
          }
          if (selectCount === 2) {
            // session counts
            return makeChain([{ programId: 1, count: 6 }]);
          }
          // waitlist rows
          return makeChain([{ programId: 1, anyOpen: true }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getPrograms } = await import("./actions");
      const result = await getPrograms();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Lash Extensions",
        type: "lash",
        price: 500,
        sessions: 6,
        active: true,
        maxSpots: 8,
        waitlistOpen: true,
      });
    });

    it("uses default maxSpots=6 when maxStudents is null", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 2,
                name: "Jewelry",
                category: "jewelry",
                priceInCents: 0,
                description: null,
                isActive: false,
                maxStudents: null,
              },
            ]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getPrograms } = await import("./actions");
      const result = await getPrograms();
      expect(result[0].maxSpots).toBe(6);
    });
  });

  /* ---- createProgram ---- */

  describe("createProgram", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { createProgram } = await import("./actions");
      await expect(
        createProgram({
          name: "Test",
          type: "lash",
          price: 100,
          sessions: 0,
          description: "",
          active: true,
          maxSpots: 6,
          waitlistOpen: false,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts program with correct category mapping", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProgram } = await import("./actions");
      await createProgram({
        name: "Business",
        type: "business",
        price: 200,
        sessions: 0,
        description: "Desc",
        active: true,
        maxSpots: 5,
        waitlistOpen: false,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Business", category: "consulting", priceInCents: 20000 }),
      );
    });

    it("inserts placeholder sessions when sessions > 0", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn((_: Record<string, unknown>) => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProgram } = await import("./actions");
      await createProgram({
        name: "Lash Course",
        type: "lash",
        price: 100,
        sessions: 3,
        description: "",
        active: true,
        maxSpots: 6,
        waitlistOpen: false,
      });
      // First call: trainingPrograms insert, second call: trainingSessions insert
      expect(mockInsert).toHaveBeenCalledTimes(2);
      const sessionValues = mockInsertValues.mock.calls[1][0];
      expect(Array.isArray(sessionValues)).toBe(true);
      expect(sessionValues).toHaveLength(3);
    });

    it("does not insert sessions when sessions=0", async () => {
      vi.resetModules();
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 10 }]) })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createProgram } = await import("./actions");
      await createProgram({
        name: "Lash",
        type: "lash",
        price: 0,
        sessions: 0,
        description: "",
        active: true,
        maxSpots: 6,
        waitlistOpen: false,
      });
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("revalidates /dashboard/training and /training", async () => {
      vi.resetModules();
      setupMocks();
      const { createProgram } = await import("./actions");
      await createProgram({
        name: "X",
        type: "lash",
        price: 0,
        sessions: 0,
        description: "",
        active: true,
        maxSpots: 6,
        waitlistOpen: false,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- updateProgram ---- */

  describe("updateProgram", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { updateProgram } = await import("./actions");
      await expect(
        updateProgram(1, {
          name: "X",
          type: "lash",
          price: 0,
          sessions: 0,
          description: "",
          active: true,
          maxSpots: 6,
          waitlistOpen: false,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("updates program fields with correct category mapping", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProgram } = await import("./actions");
      await updateProgram(1, {
        name: "Updated",
        type: "jewelry",
        price: 150,
        sessions: 3,
        description: "D",
        active: false,
        maxSpots: 4,
        waitlistOpen: true,
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated",
          category: "jewelry",
          priceInCents: 15000,
          isActive: false,
        }),
      );
    });

    it("updates waitlist status on scheduled sessions", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateProgram } = await import("./actions");
      await updateProgram(1, {
        name: "X",
        type: "lash",
        price: 0,
        sessions: 0,
        description: "",
        active: true,
        maxSpots: 6,
        waitlistOpen: true,
      });
      // Called twice: program update + sessions update
      expect(mockUpdateSet).toHaveBeenCalledTimes(2);
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isWaitlistOpen: true }));
    });

    it("revalidates /dashboard/training and /training", async () => {
      vi.resetModules();
      setupMocks();
      const { updateProgram } = await import("./actions");
      await updateProgram(1, {
        name: "X",
        type: "lash",
        price: 0,
        sessions: 0,
        description: "",
        active: true,
        maxSpots: 6,
        waitlistOpen: false,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- deleteProgram ---- */

  describe("deleteProgram", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { deleteProgram } = await import("./actions");
      await expect(deleteProgram(1)).rejects.toThrow("Not authenticated");
    });

    it("returns error when active enrollments exist", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ count: 2 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { deleteProgram } = await import("./actions");
      const result = await deleteProgram(1);
      expect(result.error).toMatch(/Cannot delete/);
    });

    it("deletes sessions and program when no active enrollments", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([{ count: 0 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteProgram } = await import("./actions");
      const result = await deleteProgram(1);
      expect(result.error).toBeUndefined();
      // Called twice: sessions + programs
      expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
    });

    it("revalidates /dashboard/training and /training on success", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ count: 0 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { deleteProgram } = await import("./actions");
      await deleteProgram(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- createEnrollment ---- */

  describe("createEnrollment", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { createEnrollment } = await import("./actions");
      await expect(
        createEnrollment({ clientId: "c1", programId: 1, status: "active", amountPaid: 100 }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts enrollment with correct status mapping", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 5 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEnrollment } = await import("./actions");
      await createEnrollment({
        clientId: "client-1",
        programId: 3,
        status: "active",
        amountPaid: 500,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          programId: 3,
          status: "enrolled",
          amountPaidInCents: 50000,
        }),
      );
    });

    it("inserts waitlist enrollment when status=waitlist", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 5 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEnrollment } = await import("./actions");
      await createEnrollment({ clientId: "c1", programId: 1, status: "waitlist", amountPaid: 0 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "waitlisted" }),
      );
    });

    it("sends confirmation email when recipient found and program exists", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({ email: "client@example.com", firstName: "Jane" });
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // program lookup
            return makeChain([{ name: "Lash Course", priceInCents: 50000 }]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 5 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEnrollment } = await import("./actions");
      await createEnrollment({ clientId: "c1", programId: 1, status: "active", amountPaid: 500 });
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          entityType: "enrollment_confirmation",
        }),
      );
    });

    it("does not throw when email send fails", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockRejectedValue(new Error("email failure"));
      setupMocks();
      const { createEnrollment } = await import("./actions");
      await expect(
        createEnrollment({ clientId: "c1", programId: 1, status: "active", amountPaid: 0 }),
      ).resolves.not.toThrow();
    });

    it("revalidates /dashboard/training and /training", async () => {
      vi.resetModules();
      setupMocks();
      const { createEnrollment } = await import("./actions");
      await createEnrollment({ clientId: "c1", programId: 1, status: "active", amountPaid: 0 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- deleteEnrollment ---- */

  describe("deleteEnrollment", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { deleteEnrollment } = await import("./actions");
      await expect(deleteEnrollment(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the enrollment", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteEnrollment } = await import("./actions");
      await deleteEnrollment(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/training and /training", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteEnrollment } = await import("./actions");
      await deleteEnrollment(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- toggleWaitlist ---- */

  describe("toggleWaitlist", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { toggleWaitlist } = await import("./actions");
      await expect(toggleWaitlist(1)).rejects.toThrow("Not authenticated");
    });

    it("sets waitlist to true when no current session found (defaults to true)", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])), // no current session → newState = true
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleWaitlist } = await import("./actions");
      await toggleWaitlist(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isWaitlistOpen: true }));
    });

    it("toggles waitlist to false when currently open", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ isWaitlistOpen: true }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleWaitlist } = await import("./actions");
      await toggleWaitlist(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isWaitlistOpen: false }),
      );
    });

    it("toggles waitlist to true when currently closed", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ isWaitlistOpen: false }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleWaitlist } = await import("./actions");
      await toggleWaitlist(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isWaitlistOpen: true }));
    });

    it("revalidates /dashboard/training and /training", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleWaitlist } = await import("./actions");
      await toggleWaitlist(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });
});
