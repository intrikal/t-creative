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

// Supabase storage mocks
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });
const mockStorageGetPublicUrl = vi.fn(() => ({
  data: { publicUrl: "https://cdn.example.com/photo.jpg" },
}));

function makeStorage() {
  return {
    upload: mockStorageUpload,
    remove: mockStorageRemove,
    getPublicUrl: mockStorageGetPublicUrl,
  };
}

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
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
      clientId: "clientId",
      title: "title",
      caption: "caption",
      publicUrl: "publicUrl",
      storagePath: "storagePath",
      fileSizeBytes: "fileSizeBytes",
      isPublished: "isPublished",
      isFeatured: "isFeatured",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
      storage: { from: vi.fn(() => makeStorage()) },
    })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("media/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getMediaItems ---- */

  describe("getMediaItems", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getMediaItems } = await import("./actions");
      await expect(getMediaItems()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no media items exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getMediaItems } = await import("./actions");
      const result = await getMediaItems();
      expect(result).toEqual([]);
    });

    it("maps rows to MediaRow shape with client name", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        type: "image",
        category: "lash",
        firstName: "Jane",
        lastName: "Doe",
        title: "My photo",
        caption: "Nice lashes",
        publicUrl: "https://cdn.example.com/photo.jpg",
        storagePath: "portfolio/lash/123-photo.jpg",
        fileSizeBytes: 100000,
        isPublished: true,
        isFeatured: false,
        createdAt: new Date("2026-04-01T10:00:00Z"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMediaItems } = await import("./actions");
      const result = await getMediaItems();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        type: "image",
        category: "lash",
        client: "Jane Doe",
        title: "My photo",
        isPublished: true,
      });
    });

    it("sets client to null when no profile is joined", async () => {
      vi.resetModules();
      const row = {
        id: 2,
        type: "video",
        category: null,
        firstName: null,
        lastName: null,
        title: null,
        caption: null,
        publicUrl: null,
        storagePath: "portfolio/general/video.mp4",
        fileSizeBytes: null,
        isPublished: false,
        isFeatured: false,
        createdAt: new Date("2026-04-01"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMediaItems } = await import("./actions");
      const result = await getMediaItems();
      expect(result[0].client).toBeNull();
    });

    it("formats date using locale string", async () => {
      vi.resetModules();
      const row = {
        id: 3,
        type: "image",
        category: "jewelry",
        firstName: null,
        lastName: null,
        title: null,
        caption: null,
        publicUrl: null,
        storagePath: "portfolio/jewelry/ring.jpg",
        fileSizeBytes: 50000,
        isPublished: true,
        isFeatured: true,
        createdAt: new Date("2026-04-01T00:00:00Z"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMediaItems } = await import("./actions");
      const result = await getMediaItems();
      expect(typeof result[0].date).toBe("string");
      expect(result[0].date.length).toBeGreaterThan(0);
    });
  });

  /* ---- getMediaStats ---- */

  describe("getMediaStats", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getMediaStats } = await import("./actions");
      await expect(getMediaStats()).rejects.toThrow("Not authenticated");
    });

    it("returns numeric stats", async () => {
      vi.resetModules();
      const statsRow = { total: "10", published: "7", featured: "3", totalSize: "1048576" };
      setupMocks({
        select: vi.fn(() => makeChain([statsRow])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMediaStats } = await import("./actions");
      const result = await getMediaStats();
      expect(result).toEqual({
        total: 10,
        published: 7,
        featured: 3,
        totalSizeBytes: 1048576,
      });
    });
  });

  /* ---- uploadMedia ---- */

  describe("uploadMedia", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { uploadMedia } = await import("./actions");
      const fd = new FormData();
      await expect(uploadMedia(fd)).rejects.toThrow("Not authenticated");
    });

    it("throws when no files provided", async () => {
      vi.resetModules();
      setupMocks();
      const { uploadMedia } = await import("./actions");
      const fd = new FormData();
      await expect(uploadMedia(fd)).rejects.toThrow("No files provided");
    });

    it("uploads file and inserts media item", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { uploadMedia } = await import("./actions");
      const file = new File(["content"], "test-photo.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("files", file);
      fd.append("category", "lash");
      fd.append("caption", "Test caption");
      await uploadMedia(fd);
      expect(mockStorageUpload).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "image",
          category: "lash",
          caption: "Test caption",
        }),
      );
    });

    it("throws when storage upload returns an error", async () => {
      vi.resetModules();
      mockStorageUpload.mockResolvedValueOnce({ error: { message: "Storage quota exceeded" } });
      setupMocks();
      const { uploadMedia } = await import("./actions");
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("files", file);
      await expect(uploadMedia(fd)).rejects.toThrow("Upload failed: Storage quota exceeded");
    });

    it("sets isFeatured and isPublished when featured flag is true", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { uploadMedia } = await import("./actions");
      const file = new File(["content"], "hero.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("files", file);
      fd.append("featured", "true");
      await uploadMedia(fd);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ isFeatured: true, isPublished: true }),
      );
    });

    it("revalidates /dashboard/media", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { uploadMedia } = await import("./actions");
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("files", file);
      await uploadMedia(fd);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    });
  });

  /* ---- togglePublish ---- */

  describe("togglePublish", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { togglePublish } = await import("./actions");
      await expect(togglePublish(1, true)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with isPublished: true when publishing", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { togglePublish } = await import("./actions");
      await togglePublish(5, true);
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isPublished: true }));
    });

    it("un-features item when unpublishing", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { togglePublish } = await import("./actions");
      await togglePublish(5, false);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: false, isFeatured: false }),
      );
    });

    it("revalidates /dashboard/media", async () => {
      vi.resetModules();
      setupMocks();
      const { togglePublish } = await import("./actions");
      await togglePublish(1, true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    });
  });

  /* ---- toggleFeatured ---- */

  describe("toggleFeatured", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleFeatured } = await import("./actions");
      await expect(toggleFeatured(1, true)).rejects.toThrow("Not authenticated");
    });

    it("auto-publishes when featuring", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleFeatured } = await import("./actions");
      await toggleFeatured(5, true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isFeatured: true, isPublished: true }),
      );
    });

    it("does not auto-publish when un-featuring", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleFeatured } = await import("./actions");
      await toggleFeatured(5, false);
      const callArg = mockUpdateSet.mock.calls[0][0];
      expect(callArg.isFeatured).toBe(false);
      expect(callArg.isPublished).toBeUndefined();
    });

    it("revalidates /dashboard/media", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleFeatured } = await import("./actions");
      await toggleFeatured(1, true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    });
  });

  /* ---- updateMediaItem ---- */

  describe("updateMediaItem", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateMediaItem } = await import("./actions");
      await expect(updateMediaItem(1, { caption: "Test" })).rejects.toThrow("Not authenticated");
    });

    it("updates provided fields only", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateMediaItem } = await import("./actions");
      await updateMediaItem(3, { caption: "Updated caption" });
      const callArg = mockUpdateSet.mock.calls[0][0];
      expect(callArg.caption).toBe("Updated caption");
    });

    it("trims caption and converts empty string to null", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateMediaItem } = await import("./actions");
      await updateMediaItem(3, { caption: "   " });
      const callArg = mockUpdateSet.mock.calls[0][0];
      expect(callArg.caption).toBeNull();
    });

    it("revalidates /dashboard/media", async () => {
      vi.resetModules();
      setupMocks();
      const { updateMediaItem } = await import("./actions");
      await updateMediaItem(1, { title: "New title" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    });
  });

  /* ---- deleteMediaItem ---- */

  describe("deleteMediaItem", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteMediaItem } = await import("./actions");
      await expect(deleteMediaItem(1)).rejects.toThrow("Not authenticated");
    });

    it("deletes from storage and DB when item exists", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([{ storagePath: "portfolio/lash/123-photo.jpg" }])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteMediaItem } = await import("./actions");
      await deleteMediaItem(5);
      expect(mockStorageRemove).toHaveBeenCalledWith(["portfolio/lash/123-photo.jpg"]);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("does not delete from DB when item is not found", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteMediaItem } = await import("./actions");
      await deleteMediaItem(999);
      expect(mockStorageRemove).not.toHaveBeenCalled();
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/media", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteMediaItem } = await import("./actions");
      await deleteMediaItem(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/media");
    });
  });
});
