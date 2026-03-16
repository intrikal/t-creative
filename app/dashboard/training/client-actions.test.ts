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

const mockGetUser = vi.fn();
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();
const mockCreateZohoDeal = vi.fn();
const mockCreateZohoBooksInvoice = vi.fn();

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
      description: "description",
      category: "category",
      format: "format",
      priceInCents: "priceInCents",
      maxStudents: "maxStudents",
      certificationProvided: "certificationProvided",
      kitIncluded: "kitIncluded",
      isActive: "isActive",
      sortOrder: "sortOrder",
    },
    trainingSessions: {
      id: "id",
      programId: "programId",
      startsAt: "startsAt",
      status: "status",
      location: "location",
      materials: "materials",
      maxStudents: "maxStudents",
      isWaitlistOpen: "isWaitlistOpen",
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
    lessonCompletions: {
      id: "id",
      lessonId: "lessonId",
      profileId: "profileId",
    },
    enrollments: {
      id: "id",
      clientId: "clientId",
      programId: "programId",
      sessionId: "sessionId",
      status: "status",
      enrolledAt: "enrolledAt",
      progressPercent: "progressPercent",
      sessionsCompleted: "sessionsCompleted",
      amountPaidInCents: "amountPaidInCents",
    },
    certificates: {
      id: "id",
      programId: "programId",
      clientId: "clientId",
      certificateCode: "certificateCode",
      pdfStoragePath: "pdfStoragePath",
      issuedAt: "issuedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
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
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: mockCreateZohoDeal }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: mockCreateZohoBooksInvoice }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("training/client-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientTraining ---- */

  describe("getClientTraining", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientTraining } = await import("./client-actions");
      await expect(getClientTraining()).rejects.toThrow("Not authenticated");
    });

    it("returns empty programs, enrollments, certificates when nothing exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientTraining } = await import("./client-actions");
      const result = await getClientTraining();
      expect(result.programs).toEqual([]);
      expect(result.enrollments).toEqual([]);
      expect(result.certificates).toEqual([]);
    });

    it("maps programs to ClientProgram shape", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // programRows
            return makeChain([
              {
                id: 1,
                name: "Lash Course",
                description: "A course",
                category: "lash",
                format: "In Person",
                priceInCents: 50000,
                maxStudents: 8,
                certificationProvided: true,
                kitIncluded: false,
              },
            ]);
          }
          // All other selects (modules, lesson counts, sessions, enrollment counts, etc.)
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientTraining } = await import("./client-actions");
      const result = await getClientTraining();
      expect(result.programs).toHaveLength(1);
      expect(result.programs[0]).toMatchObject({
        id: 1,
        name: "Lash Course",
        type: "lash",
        price: 500,
        certificationProvided: true,
        kitIncluded: false,
      });
    });

    it("maps enrollment rows to ClientEnrollment shape", async () => {
      vi.resetModules();
      // getClientTraining selects in order:
      // 1=programRows, 2=moduleRows, 3=lessonCounts, 4=upcomingSessions,
      // 5=enrollmentCounts(session), 6=programEnrollCounts, 7=enrollmentRows, 8=certRows
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 7) {
            return makeChain([
              {
                id: 10,
                programId: 1,
                status: "enrolled",
                progressPercent: 50,
                sessionsCompleted: 2,
                amountPaidInCents: 25000,
                programName: "Lash Course",
                programCategory: "lash",
                programPrice: 50000,
                sessionStartsAt: new Date("2026-04-01"),
                sessionLocation: "Studio",
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
      const { getClientTraining } = await import("./client-actions");
      const result = await getClientTraining();
      expect(result.enrollments).toHaveLength(1);
      expect(result.enrollments[0]).toMatchObject({
        id: 10,
        programId: 1,
        programName: "Lash Course",
        programType: "lash",
        status: "enrolled",
        progressPercent: 50,
        amountPaidCents: 25000,
        totalPriceCents: 50000,
      });
    });

    it("maps certificate rows to ClientCertificate shape", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          // certRows is the 7th select (programs, modules, lessonCounts, sessions, enrollCount_session, enrollCount_program, enrollmentRows, certRows)
          if (selectCount === 8) {
            return makeChain([
              {
                id: 5,
                certificateCode: "CERT-001",
                pdfStoragePath: "/certs/cert.pdf",
                issuedAt: new Date("2026-01-15"),
                programName: "Lash Course",
                programCategory: "lash",
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
      const { getClientTraining } = await import("./client-actions");
      const result = await getClientTraining();
      expect(result.certificates).toHaveLength(1);
      expect(result.certificates[0]).toMatchObject({
        id: 5,
        certificateCode: "CERT-001",
        pdfUrl: "/certs/cert.pdf",
        programName: "Lash Course",
        programType: "lash",
      });
    });
  });

  /* ---- clientEnroll ---- */

  describe("clientEnroll", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { clientEnroll } = await import("./client-actions");
      await expect(clientEnroll(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when already enrolled", async () => {
      vi.resetModules();
      // First select returns existing enrollment
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ id: 99 }]); // existing enrollment found
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await expect(clientEnroll(1)).rejects.toThrow("Already enrolled in this program");
    });

    it("inserts enrollment with status=enrolled", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 5 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])), // no existing enrollment
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await clientEnroll(3);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "user-1", programId: 3, status: "enrolled" }),
      );
    });

    it("fires trackEvent with training_enrolled", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 5 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await clientEnroll(3);
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "training_enrolled", { programId: 3 });
    });

    it("calls createZohoDeal when client profile is found", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]); // no existing enrollment
          if (selectCount === 2) return makeChain([]); // no next session
          if (selectCount === 3) return makeChain([{ name: "Lash Course", priceInCents: 50000 }]); // program
          if (selectCount === 4)
            return makeChain([{ email: "user@example.com", firstName: "Jane" }]); // client profile
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 5 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await clientEnroll(3);
      expect(mockCreateZohoDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          contactEmail: "user@example.com",
          stage: "Enrolled",
          pipeline: "Training",
        }),
      );
    });

    it("calls createZohoBooksInvoice when client profile is found", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]); // no existing enrollment
          if (selectCount === 2) return makeChain([]); // no next session
          if (selectCount === 3) return makeChain([{ name: "Lash Course", priceInCents: 50000 }]);
          if (selectCount === 4)
            return makeChain([{ email: "user@example.com", firstName: "Jane" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 5 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await clientEnroll(3);
      expect(mockCreateZohoBooksInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "enrollment",
          entityId: 5,
          email: "user@example.com",
        }),
      );
    });

    it("does not call Zoho when client profile is not found", async () => {
      vi.resetModules();
      // All selects return empty — no existing enrollment, no session, no program, no profile
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 5 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await clientEnroll(3);
      expect(mockCreateZohoDeal).not.toHaveBeenCalled();
      expect(mockCreateZohoBooksInvoice).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/training", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 5 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientEnroll } = await import("./client-actions");
      await clientEnroll(3);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
    });
  });

  /* ---- clientJoinWaitlist ---- */

  describe("clientJoinWaitlist", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { clientJoinWaitlist } = await import("./client-actions");
      await expect(clientJoinWaitlist(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when already enrolled or waitlisted", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 42 }])), // existing record found
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientJoinWaitlist } = await import("./client-actions");
      await expect(clientJoinWaitlist(1)).rejects.toThrow(
        "Already enrolled or waitlisted for this program",
      );
    });

    it("inserts enrollment with status=waitlisted", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 9 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])), // no existing record
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientJoinWaitlist } = await import("./client-actions");
      await clientJoinWaitlist(5);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "user-1", programId: 5, status: "waitlisted" }),
      );
    });

    it("fires trackEvent with training_waitlist_joined", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 9 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientJoinWaitlist } = await import("./client-actions");
      await clientJoinWaitlist(5);
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "training_waitlist_joined", {
        programId: 5,
      });
    });

    it("revalidates /dashboard/training", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 9 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { clientJoinWaitlist } = await import("./client-actions");
      await clientJoinWaitlist(5);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/training");
    });
  });
});
