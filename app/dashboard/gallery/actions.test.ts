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
const mockRevalidatePath = vi.fn();

// Mock for supabase storage
const mockGetPublicUrl = vi.fn((path: string) => ({
  data: { publicUrl: `https://storage.example.com/${path}` },
}));

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
    mediaItems: {
      id: "id",
      type: "type",
      category: "category",
      title: "title",
      caption: "caption",
      publicUrl: "publicUrl",
      beforeStoragePath: "beforeStoragePath",
      isFeatured: "isFeatured",
      clientConsentGiven: "clientConsentGiven",
      isPublished: "isPublished",
      clientId: "clientId",
      sortOrder: "sortOrder",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
      storage: {
        from: vi.fn(() => ({ getPublicUrl: mockGetPublicUrl })),
      },
    })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("gallery/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientGallery ---- */

  describe("getClientGallery", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientGallery } = await import("./actions");
      await expect(getClientGallery()).rejects.toThrow("Not authenticated");
    });

    it("returns empty portfolio and myPhotos when no rows", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientGallery } = await import("./actions");
      const result = await getClientGallery();
      expect(result.portfolio).toEqual([]);
      expect(result.myPhotos).toEqual([]);
    });

    it("maps portfolio rows to GalleryItem shape", async () => {
      vi.resetModules();
      const portfolioRow = {
        id: 1,
        type: "image",
        category: "lash",
        title: "Beautiful Lashes",
        caption: "Classic full set",
        publicUrl: "https://example.com/img.jpg",
        beforeStoragePath: null,
        isFeatured: true,
        clientConsentGiven: true,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([portfolioRow]);
          return makeChain([]); // myPhotos
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientGallery } = await import("./actions");
      const result = await getClientGallery();
      expect(result.portfolio).toHaveLength(1);
      expect(result.portfolio[0]).toMatchObject({
        id: 1,
        type: "image",
        category: "lash",
        title: "Beautiful Lashes",
        imageUrl: "https://example.com/img.jpg",
        beforeImageUrl: null,
        isFeatured: true,
        clientConsentGiven: true,
      });
    });

    it("maps myPhotos rows to GalleryItem shape", async () => {
      vi.resetModules();
      const myPhotoRow = {
        id: 5,
        type: "before_after",
        category: "jewelry",
        title: "My Bracelet",
        caption: "Permanent gold bracelet",
        publicUrl: "https://example.com/after.jpg",
        beforeStoragePath: "before/img.jpg",
        isFeatured: false,
        clientConsentGiven: false,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]); // portfolio
          return makeChain([myPhotoRow]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientGallery } = await import("./actions");
      const result = await getClientGallery();
      expect(result.myPhotos).toHaveLength(1);
      expect(result.myPhotos[0]).toMatchObject({
        id: 5,
        type: "before_after",
        clientConsentGiven: false,
      });
    });

    it("generates before image URL when beforeStoragePath is set", async () => {
      vi.resetModules();
      const portfolioRow = {
        id: 2,
        type: "before_after",
        category: "lash",
        title: "T",
        caption: "",
        publicUrl: null,
        beforeStoragePath: "before/some-image.jpg",
        isFeatured: false,
        clientConsentGiven: true,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([portfolioRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientGallery } = await import("./actions");
      const result = await getClientGallery();
      expect(result.portfolio[0].beforeImageUrl).toContain("before/some-image.jpg");
    });

    it("defaults type to 'image' when null", async () => {
      vi.resetModules();
      const portfolioRow = {
        id: 3,
        type: null,
        category: "lash",
        title: "T",
        caption: "",
        publicUrl: null,
        beforeStoragePath: null,
        isFeatured: false,
        clientConsentGiven: false,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([portfolioRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientGallery } = await import("./actions");
      const result = await getClientGallery();
      expect(result.portfolio[0].type).toBe("image");
    });
  });

  /* ---- grantPhotoConsent ---- */

  describe("grantPhotoConsent", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { grantPhotoConsent } = await import("./actions");
      await expect(grantPhotoConsent(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with clientConsentGiven=true and isPublished=true", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { grantPhotoConsent } = await import("./actions");
      await grantPhotoConsent(42);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          clientConsentGiven: true,
          isPublished: true,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("revalidates /dashboard/gallery and /dashboard/media", async () => {
      vi.resetModules();
      setupMocks();
      const { grantPhotoConsent } = await import("./actions");
      await grantPhotoConsent(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/gallery");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    });
  });
});
