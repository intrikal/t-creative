/**
 * @file client-actions.test.ts
 * @description Unit tests for aftercare/client-actions server actions.
 *
 * Testing utilities used:
 * - describe: Groups related test cases into logical blocks (one per action function).
 * - it: Defines a single test case with a human-readable description.
 * - expect: Makes assertions about values — the core of each test's pass/fail logic.
 * - vi: Vitest's mock utility namespace (vi.fn, vi.doMock, vi.resetModules, etc.).
 * - vi.fn(): Creates a mock function whose calls can be inspected and return value controlled.
 * - vi.doMock(): Lazily registers a module mock effective on the next dynamic import().
 *   Used instead of vi.mock() because each test calls vi.resetModules() + re-imports.
 * - vi.resetModules(): Clears the module registry so the next import() gets fresh mocks.
 * - vi.clearAllMocks(): Resets call counts/args on every mock without removing implementation.
 * - beforeEach: Runs before every `it` block to clear mocks and set default auth state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 * Every method (from, where, leftJoin, ...) returns the same chain,
 * and the chain is thenable — resolving to `rows` — so await works.
 */
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

/** Stub for supabase auth.getUser — controls whether the request is authenticated. */
const mockGetUser = vi.fn();

/**
 * Registers all module mocks needed by the actions under test.
 * Accepts an optional custom db object; falls back to a default
 * mock that returns empty result sets for all operations.
 */
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
    policies: {
      id: "id",
      type: "type",
      slug: "slug",
      title: "title",
      content: "content",
      category: "category",
      sortOrder: "sortOrder",
      isPublished: "isPublished",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("aftercare/client-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientAftercare ---- */

  describe("getClientAftercare", () => {
    it("returns empty array when no published aftercare sections", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientAftercare } = await import("./client-actions");
      const result = await getClientAftercare();
      expect(result).toEqual([]);
    });

    it("maps rows to ClientAftercareSection shape, parsing JSON content", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        title: "Lash Extensions",
        category: "lash",
        content: JSON.stringify({ dos: ["Keep dry for 24h"], donts: ["No oil-based products"] }),
        sortOrder: 0,
        isPublished: true,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientAftercare } = await import("./client-actions");
      const result = await getClientAftercare();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        title: "Lash Extensions",
        category: "lash",
        dos: ["Keep dry for 24h"],
        donts: ["No oil-based products"],
      });
    });

    it("returns empty dos/donts for invalid JSON content", async () => {
      vi.resetModules();
      const row = { id: 2, title: "Bad", category: null, content: "invalid", sortOrder: 0 };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientAftercare } = await import("./client-actions");
      const result = await getClientAftercare();
      expect(result[0].dos).toEqual([]);
      expect(result[0].donts).toEqual([]);
    });

    it("returns empty dos/donts when content is missing dos/donts keys", async () => {
      vi.resetModules();
      const row = {
        id: 3,
        title: "Weird",
        category: null,
        content: JSON.stringify({ something: "else" }),
        sortOrder: 0,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientAftercare } = await import("./client-actions");
      const result = await getClientAftercare();
      expect(result[0].dos).toEqual([]);
      expect(result[0].donts).toEqual([]);
    });

    it("preserves null category from row", async () => {
      vi.resetModules();
      const row = {
        id: 4,
        title: "General Care",
        category: null,
        content: JSON.stringify({ dos: [], donts: [] }),
        sortOrder: 1,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientAftercare } = await import("./client-actions");
      const result = await getClientAftercare();
      expect(result[0].category).toBeNull();
    });

    it("returns multiple sections in query order", async () => {
      vi.resetModules();
      const rows = [
        {
          id: 1,
          title: "Section A",
          category: "lash",
          content: JSON.stringify({ dos: [], donts: [] }),
          sortOrder: 0,
        },
        {
          id: 2,
          title: "Section B",
          category: "jewelry",
          content: JSON.stringify({ dos: [], donts: [] }),
          sortOrder: 1,
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientAftercare } = await import("./client-actions");
      const result = await getClientAftercare();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Section A");
      expect(result[1].title).toBe("Section B");
    });
  });
});
