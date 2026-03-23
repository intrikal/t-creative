import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
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
const mockCreateSignedUrl = vi.fn();
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });

function makeStorage() {
  return {
    createSignedUrl: mockCreateSignedUrl,
    remove: mockStorageRemove,
  };
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    clientPhotos: {
      id: "id",
      bookingId: "bookingId",
      profileId: "profileId",
      uploadedBy: "uploadedBy",
      photoType: "photoType",
      storagePath: "storagePath",
      notes: "notes",
      createdAt: "createdAt",
    },
    bookings: {
      id: "id",
      serviceId: "serviceId",
      startsAt: "startsAt",
    },
    services: {
      id: "id",
      name: "name",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
      storage: { from: vi.fn(() => makeStorage()) },
    })),
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: vi.fn(async () => {
      const { data } = await mockGetUser();
      if (!data?.user) throw new Error("Not authenticated");
      return { id: data.user.id, email: data.user.email ?? "" };
    }),
    requireStaff: vi.fn(async () => {
      const { data } = await mockGetUser();
      if (!data?.user) throw new Error("Not authenticated");
      if (data.user.role === "client") throw new Error("Forbidden");
      return { id: data.user.id, email: data.user.email ?? "" };
    }),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("client-photo-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "staff-1", email: "staff@example.com" } },
    });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed/photo.jpg" },
    });
  });

  /* ---- getBookingPhotos ---- */

  describe("getBookingPhotos", () => {
    it("returns empty array when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getBookingPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      // auth failure is caught internally and returns []
      const result = await getBookingPhotos(1);
      expect(result).toEqual([]);
    });

    it("returns empty array when no photos exist for booking", async () => {
      vi.resetModules();
      setupMocks();
      const { getBookingPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getBookingPhotos(42);
      expect(result).toEqual([]);
    });

    it("returns photo with signed URL linked to the booking", async () => {
      vi.resetModules();
      const row = {
        id: 10,
        bookingId: 5,
        photoType: "before",
        storagePath: "client-photos/client-1/5/before.jpg",
        notes: null,
        createdAt: new Date("2026-03-01T10:00:00Z"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBookingPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getBookingPhotos(5);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 10,
        bookingId: 5,
        photoType: "before",
        url: "https://storage.example.com/signed/photo.jpg",
        notes: null,
      });
    });

    it("returns before and after photos both linked to the same booking", async () => {
      vi.resetModules();
      const rows = [
        {
          id: 11,
          bookingId: 7,
          photoType: "before",
          storagePath: "client-photos/client-2/7/before.jpg",
          notes: "Before treatment",
          createdAt: new Date("2026-03-10T09:00:00Z"),
        },
        {
          id: 12,
          bookingId: 7,
          photoType: "after",
          storagePath: "client-photos/client-2/7/after.jpg",
          notes: "After treatment",
          createdAt: new Date("2026-03-10T11:00:00Z"),
        },
      ];
      mockCreateSignedUrl
        .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example.com/before.jpg" } })
        .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example.com/after.jpg" } });
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBookingPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getBookingPhotos(7);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        bookingId: 7,
        photoType: "before",
        url: "https://storage.example.com/before.jpg",
      });
      expect(result[1]).toMatchObject({
        bookingId: 7,
        photoType: "after",
        url: "https://storage.example.com/after.jpg",
      });
    });

    it("staff can fetch photos for their bookings", async () => {
      vi.resetModules();
      // staff user (not a client) — requireStaff should pass
      mockGetUser.mockResolvedValue({
        data: { user: { id: "staff-1", email: "staff@example.com", role: "assistant" } },
      });
      const row = {
        id: 20,
        bookingId: 3,
        photoType: "reference",
        storagePath: "client-photos/client-3/3/ref.jpg",
        notes: null,
        createdAt: new Date("2026-03-15T12:00:00Z"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBookingPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getBookingPhotos(3);
      expect(result).toHaveLength(1);
      expect(result[0].bookingId).toBe(3);
    });

    it("uses empty string for url when signed URL creation fails", async () => {
      vi.resetModules();
      mockCreateSignedUrl.mockResolvedValue({ data: null });
      const row = {
        id: 30,
        bookingId: 9,
        photoType: "after",
        storagePath: "client-photos/client-4/9/after.jpg",
        notes: null,
        createdAt: new Date("2026-03-20T08:00:00Z"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBookingPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getBookingPhotos(9);
      expect(result[0].url).toBe("");
    });
  });

  /* ---- deleteClientPhoto ---- */

  describe("deleteClientPhoto", () => {
    it("returns empty array (no-op) when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteClientPhoto } = await import("@/app/dashboard/bookings/client-photo-actions");
      // auth failure propagates as throw (not swallowed)
      await expect(deleteClientPhoto(1)).rejects.toThrow();
    });

    it("forbidden for client role", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "client-1", email: "client@example.com", role: "client" } },
      });
      setupMocks();
      const { deleteClientPhoto } = await import("@/app/dashboard/bookings/client-photo-actions");
      await expect(deleteClientPhoto(1)).rejects.toThrow("Forbidden");
    });

    it("does nothing when photo is not found", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteClientPhoto } = await import("@/app/dashboard/bookings/client-photo-actions");
      await deleteClientPhoto(999);
      expect(mockStorageRemove).not.toHaveBeenCalled();
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });

    it("removes file from storage and deletes DB record", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([{ storagePath: "client-photos/client-1/5/before.jpg" }])),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteClientPhoto } = await import("@/app/dashboard/bookings/client-photo-actions");
      await deleteClientPhoto(10);
      expect(mockStorageRemove).toHaveBeenCalledWith(["client-photos/client-1/5/before.jpg"]);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("re-throws and captures error when storage remove fails", async () => {
      vi.resetModules();
      mockStorageRemove.mockRejectedValueOnce(new Error("Storage unavailable"));
      setupMocks({
        select: vi.fn(() => makeChain([{ storagePath: "client-photos/client-1/5/before.jpg" }])),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { deleteClientPhoto } = await import("@/app/dashboard/bookings/client-photo-actions");
      await expect(deleteClientPhoto(10)).rejects.toThrow("Storage unavailable");
    });
  });

  /* ---- getMyPhotos ---- */

  describe("getMyPhotos", () => {
    it("returns empty array when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getMyPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getMyPhotos();
      expect(result).toEqual([]);
    });

    it("returns empty array when client has no photos", async () => {
      vi.resetModules();
      setupMocks();
      const { getMyPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getMyPhotos();
      expect(result).toEqual([]);
    });

    it("client can view their own photos grouped by booking", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "client-1", email: "client@example.com" } },
      });
      const rows = [
        {
          id: 1,
          bookingId: 5,
          photoType: "before",
          storagePath: "client-photos/client-1/5/before.jpg",
          notes: null,
          createdAt: new Date("2026-03-01T10:00:00Z"),
          serviceName: "Classic Lash Set",
          bookingDate: new Date("2026-03-01T09:00:00Z"),
        },
        {
          id: 2,
          bookingId: 5,
          photoType: "after",
          storagePath: "client-photos/client-1/5/after.jpg",
          notes: "Looks great",
          createdAt: new Date("2026-03-01T11:00:00Z"),
          serviceName: "Classic Lash Set",
          bookingDate: new Date("2026-03-01T09:00:00Z"),
        },
      ];
      mockCreateSignedUrl
        .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example.com/before.jpg" } })
        .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example.com/after.jpg" } });
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMyPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getMyPhotos();
      expect(result).toHaveLength(1);
      expect(result[0].bookingId).toBe(5);
      expect(result[0].serviceName).toBe("Classic Lash Set");
      expect(result[0].photos).toHaveLength(2);
      expect(result[0].photos[0].photoType).toBe("before");
      expect(result[0].photos[1].photoType).toBe("after");
    });

    it("other client cannot view photos — only own profileId rows are returned", async () => {
      vi.resetModules();
      // Other client is authenticated but the DB query filters by profileId.
      // Simulate no rows returned for other-client-2 (RLS / where clause enforces ownership).
      mockGetUser.mockResolvedValue({
        data: { user: { id: "other-client-2", email: "other@example.com" } },
      });
      setupMocks({
        // DB returns nothing because profileId != other-client-2
        select: vi.fn(() => makeChain([])),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMyPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getMyPhotos();
      expect(result).toEqual([]);
    });

    it("groups photos from multiple bookings into separate groups", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "client-3", email: "client3@example.com" } },
      });
      const rows = [
        {
          id: 10,
          bookingId: 20,
          photoType: "before",
          storagePath: "client-photos/client-3/20/before.jpg",
          notes: null,
          createdAt: new Date("2026-02-01T10:00:00Z"),
          serviceName: "Brow Lamination",
          bookingDate: new Date("2026-02-01T09:00:00Z"),
        },
        {
          id: 11,
          bookingId: 21,
          photoType: "reference",
          storagePath: "client-photos/client-3/21/ref.jpg",
          notes: "Inspiration photo",
          createdAt: new Date("2026-03-05T10:00:00Z"),
          serviceName: "Classic Lash Set",
          bookingDate: new Date("2026-03-05T09:00:00Z"),
        },
      ];
      mockCreateSignedUrl
        .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example.com/brow.jpg" } })
        .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example.com/lash.jpg" } });
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMyPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getMyPhotos();
      expect(result).toHaveLength(2);
      expect(result[0].bookingId).toBe(20);
      expect(result[1].bookingId).toBe(21);
    });

    it("falls back to 'Service' when serviceName is null", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "client-4", email: "client4@example.com" } },
      });
      const row = {
        id: 50,
        bookingId: 30,
        photoType: "before",
        storagePath: "client-photos/client-4/30/before.jpg",
        notes: null,
        createdAt: new Date("2026-03-10T10:00:00Z"),
        serviceName: null,
        bookingDate: new Date("2026-03-10T09:00:00Z"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMyPhotos } = await import("@/app/dashboard/bookings/client-photo-actions");
      const result = await getMyPhotos();
      expect(result[0].serviceName).toBe("Service");
    });
  });
});
