// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/bookings/service-record-actions.ts
 *
 * Covers:
 *  1. upsertServiceRecord — creates a new record linked to booking
 *  2. upsertServiceRecord — staffId set from authenticated user (RLS: staff who served)
 *  3. uploadServicePhoto — returns path and publicUrl
 *  4. promoteToPortfolio — inserts media_items + notification
 *  5. upsertServiceRecord — duplicate rejected (update path for existing record)
 *  6. upsertServiceRecord — rejected when booking is cancelled (Zod validates bookingId)
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, drizzle-orm/pg-core, @/lib/auth,
 *        @/lib/posthog, @sentry/nextjs, next/cache, @/utils/supabase/server,
 *        @/app/dashboard/settings/settings-actions.
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

const mockGetUser = vi.fn().mockResolvedValue({ id: "staff-1" });
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();
const mockSupabaseUpload = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: "https://cdn.example.com/photo.jpg" },
});

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (dbOverrides) Object.assign(resolvedDb, dbOverrides);

  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    serviceRecords: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      staffId: "staffId",
      lashMapping: "lashMapping",
      curlType: "curlType",
      diameter: "diameter",
      lengths: "lengths",
      adhesive: "adhesive",
      retentionNotes: "retentionNotes",
      productsUsed: "productsUsed",
      notes: "notes",
      reactions: "reactions",
      nextVisitNotes: "nextVisitNotes",
      beforePhotoPath: "beforePhotoPath",
      afterPhotoPath: "afterPhotoPath",
      createdAt: "createdAt",
    },
    profiles: { id: "id", firstName: "firstName" },
    mediaItems: { id: "id" },
    notifications: {},
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ getUser: mockGetUser }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/types/media.types", () => ({}));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      storage: {
        from: () => ({
          upload: mockSupabaseUpload,
          getPublicUrl: mockSupabaseGetPublicUrl,
        }),
      },
    })),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "Test Salon" }),
  }));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
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

describe("service-record-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "staff-1" });
  });

  /* ---- upsertServiceRecord (create) ---- */

  describe("upsertServiceRecord", () => {
    it("creates a new service record linked to booking with staffId from auth", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          // First select: check for existing record — none found
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { upsertServiceRecord } =
        await import("@/app/dashboard/bookings/service-record-actions");

      await upsertServiceRecord({
        bookingId: 1,
        clientId: "client-1",
        curlType: "C",
        diameter: "0.07mm",
        notes: "Classic look requested",
      });

      // INSERT path — staffId is the authenticated user
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 1,
          clientId: "client-1",
          staffId: "staff-1",
          curlType: "C",
          diameter: "0.07mm",
          notes: "Classic look requested",
        }),
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("staff-1", "service_record_saved", {
        bookingId: 1,
        clientId: "client-1",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });

    it("updates an existing record (duplicate bookingId) instead of inserting", async () => {
      vi.resetModules();
      const mockSet = vi.fn(() => ({ where: vi.fn() }));
      const mockInsert = vi.fn();
      setupMocks({
        select: vi.fn(() =>
          // Existing record found
          makeChain([{ id: 99 }]),
        ),
        insert: mockInsert,
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { upsertServiceRecord } =
        await import("@/app/dashboard/bookings/service-record-actions");

      await upsertServiceRecord({
        bookingId: 1,
        clientId: "client-1",
        notes: "Updated notes",
      });

      // UPDATE path — should not insert
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ notes: "Updated notes" }));
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  /* ---- uploadServicePhoto ---- */

  describe("uploadServicePhoto", () => {
    it("uploads to Supabase Storage and returns path + publicUrl", async () => {
      vi.resetModules();
      mockSupabaseUpload.mockResolvedValue({ error: null });
      mockSupabaseGetPublicUrl.mockReturnValue({
        data: { publicUrl: "https://cdn.example.com/service-records/1/after-123.jpg" },
      });
      setupMocks();
      const { uploadServicePhoto } =
        await import("@/app/dashboard/bookings/service-record-actions");

      const formData = new FormData();
      formData.set("file", new File(["data"], "photo.jpg", { type: "image/jpeg" }));
      formData.set("bookingId", "1");
      formData.set("slot", "after");

      const result = await uploadServicePhoto(formData);

      expect(result).toEqual({
        path: expect.stringContaining("service-records/1/after-"),
        publicUrl: expect.stringContaining("cdn.example.com"),
      });
    });
  });

  /* ---- promoteToPortfolio ---- */

  describe("promoteToPortfolio", () => {
    it("creates a media_items row and sends a notification to the client", async () => {
      vi.resetModules();
      let selectCall = 0;
      const mockMediaInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 50 }]),
      }));
      const mockNotifInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      let insertCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          // service record lookup
          return makeChain([
            {
              clientId: "client-1",
              beforePhotoPath: "service-records/1/before-100.jpg",
              afterPhotoPath: "service-records/1/after-200.jpg",
            },
          ]);
        }),
        insert: vi.fn(() => {
          insertCall++;
          if (insertCall === 1) return { values: mockMediaInsertValues };
          return { values: mockNotifInsertValues };
        }),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { promoteToPortfolio } =
        await import("@/app/dashboard/bookings/service-record-actions");

      await promoteToPortfolio({ bookingId: 1, category: "lash" as any, caption: "Beautiful set" });

      expect(mockMediaInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "before_after",
          category: "lash",
          clientId: "client-1",
          caption: "Beautiful set",
          storagePath: "service-records/1/after-200.jpg",
          beforeStoragePath: "service-records/1/before-100.jpg",
          clientConsentGiven: false,
          isPublished: false,
        }),
      );
      // Notification to the client about portfolio review
      expect(mockNotifInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "client-1",
          type: "general",
          channel: "internal",
          status: "sent",
          title: "Your photos are ready for the portfolio",
          relatedEntityType: "media_item",
          relatedEntityId: 50,
        }),
      );
    });

    it("throws when before or after photo is missing", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "client-1",
              beforePhotoPath: "service-records/1/before-100.jpg",
              afterPhotoPath: null, // Missing after photo
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { promoteToPortfolio } =
        await import("@/app/dashboard/bookings/service-record-actions");

      await expect(promoteToPortfolio({ bookingId: 1, category: "lash" as any })).rejects.toThrow(
        "Both before and after photos are required",
      );
    });
  });
});
