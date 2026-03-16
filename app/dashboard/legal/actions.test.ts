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
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();

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
    legalDocuments: {
      id: "id",
      type: "type",
      version: "version",
      intro: "intro",
      sections: "sections",
      effectiveDate: "effectiveDate",
      changeNotes: "changeNotes",
      isPublished: "isPublished",
      publishedAt: "publishedAt",
      sortOrder: "sortOrder",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("legal/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getLegalDoc ---- */

  describe("getLegalDoc", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getLegalDoc } = await import("./actions");
      await expect(getLegalDoc("privacy_policy")).rejects.toThrow("Not authenticated");
    });

    it("returns null when no document exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getLegalDoc } = await import("./actions");
      const result = await getLegalDoc("privacy_policy");
      expect(result).toBeNull();
    });

    it("returns mapped LegalDocEntry when row exists", async () => {
      vi.resetModules();
      const publishedAt = new Date("2025-01-01T00:00:00Z");
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              type: "privacy_policy",
              version: "1.0",
              intro: "Intro text",
              sections: [{ title: "Section 1", paragraphs: ["Para 1"] }],
              effectiveDate: "2025-01-01",
              changeNotes: "Initial release",
              isPublished: true,
              publishedAt,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getLegalDoc } = await import("./actions");
      const result = await getLegalDoc("privacy_policy");
      expect(result).toMatchObject({
        id: 1,
        type: "privacy_policy",
        version: "1.0",
        isPublished: true,
        publishedAt: publishedAt.toISOString(),
      });
    });

    it("sets publishedAt to null when row has no publishedAt", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 2,
              type: "terms_of_service",
              version: "1.0",
              intro: "Terms",
              sections: [],
              effectiveDate: "2025-01-01",
              changeNotes: null,
              isPublished: false,
              publishedAt: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getLegalDoc } = await import("./actions");
      const result = await getLegalDoc("terms_of_service");
      expect(result?.publishedAt).toBeNull();
    });

    it("captures and rethrows exceptions via Sentry", async () => {
      vi.resetModules();
      const dbError = new Error("DB exploded");
      setupMocks({
        select: vi.fn(() => {
          throw dbError;
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      });
      const { getLegalDoc } = await import("./actions");
      await expect(getLegalDoc("privacy_policy")).rejects.toThrow("DB exploded");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });

  /* ---- saveLegalDoc ---- */

  describe("saveLegalDoc", () => {
    const input = {
      version: "2.0",
      intro: "Updated intro",
      sections: [{ title: "New Section", paragraphs: ["Updated para"] }],
      effectiveDate: "2026-01-01",
      changeNotes: "Updated terms",
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveLegalDoc } = await import("./actions");
      await expect(saveLegalDoc("privacy_policy", input)).rejects.toThrow("Not authenticated");
    });

    it("updates existing document when row already exists", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 5 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveLegalDoc } = await import("./actions");
      await saveLegalDoc("privacy_policy", input);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          version: "2.0",
          isPublished: true,
          publishedAt: expect.any(Date),
        }),
      );
    });

    it("inserts new document when no existing row", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveLegalDoc } = await import("./actions");
      await saveLegalDoc("privacy_policy", input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "privacy_policy",
          version: "2.0",
          isPublished: true,
          sortOrder: 0,
        }),
      );
    });

    it("uses sortOrder 1 when type is terms_of_service", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveLegalDoc } = await import("./actions");
      await saveLegalDoc("terms_of_service", input);
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 1 }));
    });

    it("revalidates /dashboard/legal and /privacy for privacy_policy", async () => {
      vi.resetModules();
      setupMocks();
      const { saveLegalDoc } = await import("./actions");
      await saveLegalDoc("privacy_policy", input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/legal");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/privacy");
    });

    it("revalidates /dashboard/legal and /terms for terms_of_service", async () => {
      vi.resetModules();
      setupMocks();
      const { saveLegalDoc } = await import("./actions");
      await saveLegalDoc("terms_of_service", input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/legal");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/terms");
    });
  });

  /* ---- seedLegalDefaults ---- */

  describe("seedLegalDefaults", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { seedLegalDefaults } = await import("./actions");
      await expect(seedLegalDefaults()).rejects.toThrow("Not authenticated");
    });

    it("returns early without inserting when documents already exist", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1 }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { seedLegalDefaults } = await import("./actions");
      await seedLegalDefaults();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("inserts privacy policy and terms of service when table is empty", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { seedLegalDefaults } = await import("./actions");
      await seedLegalDefaults();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "privacy_policy", isPublished: true }),
          expect.objectContaining({ type: "terms_of_service", isPublished: true }),
        ]),
      );
    });
  });
});
