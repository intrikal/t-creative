import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/portfolio/actions.ts
 *
 * Covers:
 *  getPublishedMedia — returns published items with beforePublicUrl constructed from env
 *  getPublishedMedia — beforePublicUrl is null when beforeStoragePath is null
 *  getPublishedMedia — beforePublicUrl is null when NEXT_PUBLIC_SUPABASE_URL is not set
 *  getPublishedMedia — returns empty array when no published items
 *  getPublishedMedia — isFeatured flag passed through correctly
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

function setupMocks(rows: unknown[] = [], supabaseUrl?: string) {
  const selectFn = vi.fn(() => makeChain(rows));

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    mediaItems: {
      id: "id",
      type: "type",
      category: "category",
      title: "title",
      caption: "caption",
      publicUrl: "publicUrl",
      beforeStoragePath: "beforeStoragePath",
      isFeatured: "isFeatured",
      isPublished: "isPublished",
      sortOrder: "sortOrder",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
  }));
  vi.doMock("next/cache", () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn(),
    revalidateTag: vi.fn(),
  }));

  // Set or clear the Supabase URL env var
  if (supabaseUrl !== undefined) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }

  return { selectFn };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("portfolio/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- happy path ---- */

  describe("getPublishedMedia — with items", () => {
    it("returns published items with beforePublicUrl constructed from env", async () => {
      vi.resetModules();
      setupMocks(
        [
          {
            id: 1,
            type: "before_after",
            category: "lash",
            title: "Classic Set",
            caption: "Beautiful lash set",
            publicUrl: "https://cdn.example.com/after.jpg",
            beforeStoragePath: "portfolio/before-1.jpg",
            isFeatured: true,
          },
        ],
        "https://supabase.example.com",
      );
      const { getPublishedMedia } = await import("@/app/portfolio/actions");

      const result = await getPublishedMedia();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        type: "before_after",
        category: "lash",
        title: "Classic Set",
        isFeatured: true,
        publicUrl: "https://cdn.example.com/after.jpg",
        beforePublicUrl:
          "https://supabase.example.com/storage/v1/object/public/media/portfolio/before-1.jpg",
      });
    });

    it("sets beforePublicUrl to null when beforeStoragePath is null", async () => {
      vi.resetModules();
      setupMocks(
        [
          {
            id: 2,
            type: "photo",
            category: "jewelry",
            title: null,
            caption: null,
            publicUrl: "https://cdn.example.com/photo.jpg",
            beforeStoragePath: null,
            isFeatured: false,
          },
        ],
        "https://supabase.example.com",
      );
      const { getPublishedMedia } = await import("@/app/portfolio/actions");

      const result = await getPublishedMedia();

      expect(result[0].beforePublicUrl).toBeNull();
    });

    it("sets beforePublicUrl to null when NEXT_PUBLIC_SUPABASE_URL is not set", async () => {
      vi.resetModules();
      setupMocks(
        [
          {
            id: 3,
            type: "before_after",
            category: "lash",
            title: "Volume",
            caption: null,
            publicUrl: null,
            beforeStoragePath: "portfolio/before-3.jpg",
            isFeatured: false,
          },
        ],
        // no supabase URL
      );
      const { getPublishedMedia } = await import("@/app/portfolio/actions");

      const result = await getPublishedMedia();

      expect(result[0].beforePublicUrl).toBeNull();
    });
  });

  /* ---- empty ---- */

  describe("getPublishedMedia — empty", () => {
    it("returns empty array when no published items exist", async () => {
      vi.resetModules();
      setupMocks([], "https://supabase.example.com");
      const { getPublishedMedia } = await import("@/app/portfolio/actions");

      const result = await getPublishedMedia();

      expect(result).toEqual([]);
    });
  });

  /* ---- isFeatured flag ---- */

  describe("getPublishedMedia — isFeatured", () => {
    it("passes isFeatured through correctly for both true and false", async () => {
      vi.resetModules();
      setupMocks(
        [
          {
            id: 10,
            type: "photo",
            category: "lash",
            title: "Hero",
            caption: null,
            publicUrl: "https://cdn.example.com/hero.jpg",
            beforeStoragePath: null,
            isFeatured: true,
          },
          {
            id: 11,
            type: "photo",
            category: "lash",
            title: "Gallery",
            caption: null,
            publicUrl: "https://cdn.example.com/gallery.jpg",
            beforeStoragePath: null,
            isFeatured: false,
          },
        ],
        "https://supabase.example.com",
      );
      const { getPublishedMedia } = await import("@/app/portfolio/actions");

      const result = await getPublishedMedia();

      expect(result[0].isFeatured).toBe(true);
      expect(result[1].isFeatured).toBe(false);
    });
  });
});
