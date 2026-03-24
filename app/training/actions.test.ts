import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/training/actions.ts
 *
 * Covers:
 *  getPublishedPrograms — returns active programs with next session and curriculum
 *  getPublishedPrograms — returns [] when no active programs
 *  getPublishedPrograms — nextSession is null when all sessions are past/none
 *  getPublishedPrograms — curriculum modules grouped and ordered by sortOrder
 *  getPublishedPrograms — multiple programs each get their own nearest session
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, next/cache.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    then(onFulfilled: (v: unknown) => unknown) {
      return resolved.then(onFulfilled);
    },
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(selectResponses: unknown[][] = []) {
  let callIdx = 0;
  const selectFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    trainingPrograms: {
      id: "id",
      name: "name",
      slug: "slug",
      description: "description",
      category: "category",
      format: "format",
      durationHours: "durationHours",
      durationDays: "durationDays",
      priceInCents: "priceInCents",
      certificationProvided: "certificationProvided",
      kitIncluded: "kitIncluded",
      maxStudents: "maxStudents",
      isActive: "isActive",
      sortOrder: "sortOrder",
    },
    trainingSessions: {
      id: "id",
      programId: "programId",
      startsAt: "startsAt",
      location: "location",
      meetingUrl: "meetingUrl",
      status: "status",
    },
    trainingModules: {
      id: "id",
      programId: "programId",
      name: "name",
      sortOrder: "sortOrder",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        as: vi.fn(),
      },
    ),
  }));
  // next/cache stubs — "use cache" directive calls these at module level
  vi.doMock("next/cache", () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn(),
    revalidateTag: vi.fn(),
  }));

  return { selectFn };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("training/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- empty programs ---- */

  describe("getPublishedPrograms — empty", () => {
    it("returns empty array when no active programs exist", async () => {
      vi.resetModules();
      setupMocks([
        [], // no programs
      ]);
      const { getPublishedPrograms } = await import("@/app/training/actions");

      const result = await getPublishedPrograms();

      expect(result).toEqual([]);
    });
  });

  /* ---- program with session and curriculum ---- */

  describe("getPublishedPrograms — full data", () => {
    it("returns program with nextSession and curriculum modules", async () => {
      vi.resetModules();
      const futureDate = new Date("2026-08-01T09:00:00Z");
      setupMocks([
        // Query 1: active programs
        [
          {
            id: 1,
            name: "Classic Lash Certification",
            slug: "classic-lash",
            description: "Learn classic lash application.",
            category: "lash",
            format: "in-person",
            durationHours: 8,
            durationDays: 1,
            priceInCents: 59900,
            certificationProvided: true,
            kitIncluded: true,
            maxStudents: 6,
            isActive: true,
            sortOrder: 1,
          },
        ],
        // Query 2: upcoming sessions
        [
          {
            programId: 1,
            startsAt: futureDate,
            location: "Main Studio",
            meetingUrl: null,
          },
        ],
        // Query 3: curriculum modules
        [
          { programId: 1, name: "Safety & Sanitation", sortOrder: 1 },
          { programId: 1, name: "Lash Anatomy", sortOrder: 2 },
          { programId: 1, name: "Application Techniques", sortOrder: 3 },
        ],
      ]);
      const { getPublishedPrograms } = await import("@/app/training/actions");

      const result = await getPublishedPrograms();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Classic Lash Certification",
        slug: "classic-lash",
        certificationProvided: true,
        kitIncluded: true,
        priceInCents: 59900,
      });
      expect(result[0].nextSession).toMatchObject({
        startsAt: futureDate.toISOString(),
        location: "Main Studio",
        meetingUrl: null,
      });
      expect(result[0].curriculum).toEqual([
        "Safety & Sanitation",
        "Lash Anatomy",
        "Application Techniques",
      ]);
    });
  });

  /* ---- no upcoming sessions ---- */

  describe("getPublishedPrograms — no sessions", () => {
    it("sets nextSession to null when no upcoming sessions exist", async () => {
      vi.resetModules();
      setupMocks([
        // programs
        [
          {
            id: 2,
            name: "Volume Lash Advanced",
            slug: "volume-lash",
            description: null,
            category: "lash",
            format: "in-person",
            durationHours: 16,
            durationDays: 2,
            priceInCents: 89900,
            certificationProvided: true,
            kitIncluded: false,
            maxStudents: 4,
            isActive: true,
            sortOrder: 2,
          },
        ],
        [], // no upcoming sessions
        [], // no curriculum modules
      ]);
      const { getPublishedPrograms } = await import("@/app/training/actions");

      const result = await getPublishedPrograms();

      expect(result[0].nextSession).toBeNull();
      expect(result[0].curriculum).toEqual([]);
    });
  });

  /* ---- multiple programs — each gets nearest session ---- */

  describe("getPublishedPrograms — multiple programs", () => {
    it("assigns nearest session to each program independently", async () => {
      vi.resetModules();
      const session1 = new Date("2026-07-10T09:00:00Z");
      const session2 = new Date("2026-07-10T14:00:00Z");
      const session1later = new Date("2026-09-01T09:00:00Z");
      setupMocks([
        // programs
        [
          {
            id: 1,
            name: "Program A",
            slug: "prog-a",
            description: null,
            category: null,
            format: "in-person",
            durationHours: null,
            durationDays: null,
            priceInCents: null,
            certificationProvided: false,
            kitIncluded: false,
            maxStudents: null,
            isActive: true,
            sortOrder: 1,
          },
          {
            id: 2,
            name: "Program B",
            slug: "prog-b",
            description: null,
            category: null,
            format: "online",
            durationHours: null,
            durationDays: null,
            priceInCents: null,
            certificationProvided: false,
            kitIncluded: false,
            maxStudents: null,
            isActive: true,
            sortOrder: 2,
          },
        ],
        // sessions — multiple for prog 1, one for prog 2
        [
          { programId: 1, startsAt: session1, location: "Studio A", meetingUrl: null },
          {
            programId: 2,
            startsAt: session2,
            location: "Online",
            meetingUrl: "https://zoom.example",
          },
          { programId: 1, startsAt: session1later, location: "Studio A", meetingUrl: null },
        ],
        // modules
        [
          { programId: 1, name: "Module 1", sortOrder: 1 },
          { programId: 2, name: "Online Intro", sortOrder: 1 },
        ],
      ]);
      const { getPublishedPrograms } = await import("@/app/training/actions");

      const result = await getPublishedPrograms();

      expect(result).toHaveLength(2);
      // Program A gets its nearest session (session1, not session1later)
      expect(result[0].nextSession!.startsAt).toBe(session1.toISOString());
      // Program B gets its session
      expect(result[1].nextSession!.startsAt).toBe(session2.toISOString());
      expect(result[1].nextSession!.meetingUrl).toBe("https://zoom.example");
      // Curriculum split by program
      expect(result[0].curriculum).toEqual(["Module 1"]);
      expect(result[1].curriculum).toEqual(["Online Intro"]);
    });
  });
});
