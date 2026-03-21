/**
 * @file actions.test.ts
 * @description Unit tests for reviews/actions (admin review management,
 * assistant review access, approve/reject/feature, staff reply, rating stats).
 *
 * Testing utilities: describe, it, expect, vi, vi.doMock, vi.resetModules,
 * vi.clearAllMocks, beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
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
    groupBy: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
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
    reviews: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
      rating: "rating",
      serviceName: "serviceName",
      source: "source",
      body: "body",
      status: "status",
      isFeatured: "isFeatured",
      staffResponse: "staffResponse",
      staffRespondedAt: "staffRespondedAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
    bookings: {
      id: "id",
      staffId: "staffId",
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
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("reviews/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getReviews ---- */

  describe("getReviews", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getReviews } = await import("./actions");
      await expect(getReviews()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no reviews", async () => {
      vi.resetModules();
      setupMocks();
      const { getReviews } = await import("./actions");
      const result = await getReviews();
      expect(result).toEqual([]);
    });

    it("maps review rows to ReviewRow shape", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        firstName: "Jane",
        lastName: "Doe",
        rating: 5,
        serviceName: "Lash Extensions",
        source: "google",
        body: "Excellent service!",
        status: "approved",
        isFeatured: false,
        staffResponse: null,
        createdAt: new Date("2026-01-15"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviews } = await import("./actions");
      const result = await getReviews();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        client: "Jane Doe",
        rating: 5,
        serviceName: "Lash Extensions",
        source: "google",
        status: "approved",
        reply: null,
      });
    });

    it("maps featured+approved review to status 'featured'", async () => {
      vi.resetModules();
      const row = {
        id: 2,
        firstName: "Bob",
        lastName: "Smith",
        rating: 5,
        serviceName: "Brows",
        source: null,
        body: "Amazing!",
        status: "approved",
        isFeatured: true,
        staffResponse: null,
        createdAt: new Date("2026-02-01"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviews } = await import("./actions");
      const result = await getReviews();
      expect(result[0].status).toBe("featured");
    });

    it("maps rejected review to status 'hidden'", async () => {
      vi.resetModules();
      const row = {
        id: 3,
        firstName: "Alice",
        lastName: null,
        rating: 1,
        serviceName: null,
        source: null,
        body: "Bad experience",
        status: "rejected",
        isFeatured: false,
        staffResponse: null,
        createdAt: new Date("2026-02-10"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviews } = await import("./actions");
      const result = await getReviews();
      expect(result[0].status).toBe("hidden");
    });

    it("uses 'Unknown' for client name when both names are null", async () => {
      vi.resetModules();
      const row = {
        id: 4,
        firstName: null,
        lastName: null,
        rating: 4,
        serviceName: "Nails",
        source: null,
        body: "Good",
        status: "pending",
        isFeatured: false,
        staffResponse: null,
        createdAt: new Date("2026-02-15"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviews } = await import("./actions");
      const result = await getReviews();
      expect(result[0].client).toBe("Unknown");
    });

    it("uses 'General' for serviceName when null", async () => {
      vi.resetModules();
      const row = {
        id: 5,
        firstName: "Tom",
        lastName: "Brown",
        rating: 3,
        serviceName: null,
        source: null,
        body: "OK",
        status: "approved",
        isFeatured: false,
        staffResponse: null,
        createdAt: new Date("2026-02-20"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviews } = await import("./actions");
      const result = await getReviews();
      expect(result[0].serviceName).toBe("General");
    });
  });

  /* ---- getReviewStats ---- */

  describe("getReviewStats", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getReviewStats } = await import("./actions");
      await expect(getReviewStats()).rejects.toThrow("Not authenticated");
    });

    it("returns ReviewStats shape with zeros when no reviews", async () => {
      vi.resetModules();
      const statsRow = {
        total: 0,
        avgRating: 0,
        pending: 0,
        featured: 0,
        withReply: 0,
        fiveStar: 0,
      };
      setupMocks({
        select: vi.fn(() => makeChain([statsRow])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviewStats } = await import("./actions");
      const result = await getReviewStats();
      expect(result).toMatchObject({
        totalReviews: expect.any(Number),
        avgRating: expect.any(Number),
        pendingCount: expect.any(Number),
        featuredCount: expect.any(Number),
        withReplyCount: expect.any(Number),
        fiveStarCount: expect.any(Number),
        ratingDist: expect.any(Array),
      });
      expect(result.ratingDist).toHaveLength(5); // 1–5 stars
    });

    it("returns 5-entry ratingDist covering stars 1-5", async () => {
      vi.resetModules();
      const statsRow = {
        total: 10,
        avgRating: 4.5,
        pending: 2,
        featured: 1,
        withReply: 3,
        fiveStar: 5,
      };
      const ratingRows = [
        { rating: 5, count: 5 },
        { rating: 4, count: 3 },
        { rating: 3, count: 1 },
        { rating: 2, count: 1 },
      ];
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount <= 2) return makeChain([statsRow]);
          return makeChain(ratingRows);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getReviewStats } = await import("./actions");
      const result = await getReviewStats();
      expect(result.ratingDist).toHaveLength(5);
      const stars = result.ratingDist.map((r) => r.stars);
      expect(stars).toContain(5);
      expect(stars).toContain(1);
    });
  });

  /* ---- approveReview ---- */

  describe("approveReview", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { approveReview } = await import("./actions");
      await expect(approveReview(1)).rejects.toThrow("Not authenticated");
    });

    it("updates review status to 'approved'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveReview } = await import("./actions");
      await approveReview(5);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "approved", updatedAt: expect.any(Date) }),
      );
    });

    it("revalidates /dashboard/reviews", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { approveReview } = await import("./actions");
      await approveReview(5);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/reviews");
    });
  });

  /* ---- rejectReview ---- */

  describe("rejectReview", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { rejectReview } = await import("./actions");
      await expect(rejectReview(1)).rejects.toThrow("Not authenticated");
    });

    it("updates review to rejected and unfeatures it", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rejectReview } = await import("./actions");
      await rejectReview(3);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "rejected", isFeatured: false }),
      );
    });

    it("revalidates /dashboard/reviews", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rejectReview } = await import("./actions");
      await rejectReview(3);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/reviews");
    });
  });

  /* ---- featureReview ---- */

  describe("featureReview", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { featureReview } = await import("./actions");
      await expect(featureReview(1)).rejects.toThrow("Not authenticated");
    });

    it("sets isFeatured=true and status='approved'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { featureReview } = await import("./actions");
      await featureReview(7);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isFeatured: true, status: "approved" }),
      );
    });

    it("revalidates /dashboard/reviews", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { featureReview } = await import("./actions");
      await featureReview(7);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/reviews");
    });
  });

  /* ---- unfeatureReview ---- */

  describe("unfeatureReview", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { unfeatureReview } = await import("./actions");
      await expect(unfeatureReview(1)).rejects.toThrow("Not authenticated");
    });

    it("sets isFeatured=false", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { unfeatureReview } = await import("./actions");
      await unfeatureReview(9);
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isFeatured: false }));
    });

    it("revalidates /dashboard/reviews", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { unfeatureReview } = await import("./actions");
      await unfeatureReview(9);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/reviews");
    });
  });

  /* ---- saveReply ---- */

  describe("saveReply", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveReply } = await import("./actions");
      await expect(saveReply(1, "Great!")).rejects.toThrow("Not authenticated");
    });

    it("saves trimmed reply text", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveReply } = await import("./actions");
      await saveReply(2, "  Thank you!  ");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          staffResponse: "Thank you!",
          staffRespondedAt: expect.any(Date),
        }),
      );
    });

    it("sets staffResponse to null when reply is empty", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveReply } = await import("./actions");
      await saveReply(2, "   ");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ staffResponse: null, staffRespondedAt: null }),
      );
    });

    it("revalidates /dashboard/reviews", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveReply } = await import("./actions");
      await saveReply(2, "Thanks!");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/reviews");
    });
  });

  /* ---- getAssistantReviews ---- */

  describe("getAssistantReviews", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAssistantReviews } = await import("./actions");
      await expect(getAssistantReviews()).rejects.toThrow("Not authenticated");
    });

    it("returns AssistantReviewsData shape with empty reviews", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantReviews } = await import("./actions");
      const result = await getAssistantReviews();
      expect(result).toMatchObject({
        reviews: [],
        stats: {
          totalReviews: 0,
          avgRating: 0,
          fiveStarCount: expect.any(Number),
          fourStarCount: expect.any(Number),
          thisMonthCount: expect.any(Number),
          responseRate: expect.any(Number),
          repliedCount: expect.any(Number),
          ratingDist: expect.any(Array),
        },
      });
    });

    it("maps review rows correctly with initials", async () => {
      vi.resetModules();
      const row = {
        id: 10,
        firstName: "Jane",
        lastName: "Doe",
        rating: 5,
        serviceName: "Lash Extensions",
        source: "google",
        body: "Amazing work!",
        staffResponse: null,
        createdAt: new Date("2026-03-10"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantReviews } = await import("./actions");
      const result = await getAssistantReviews();
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0]).toMatchObject({
        id: 10,
        rating: 5,
        service: "Lash Extensions",
        replied: false,
        replyText: null,
        clientInitials: "JD",
      });
    });

    it("computes avgRating correctly from multiple reviews", async () => {
      vi.resetModules();
      const makeRow = (rating: number) => ({
        id: rating,
        firstName: "A",
        lastName: "B",
        rating,
        serviceName: "Service",
        source: null,
        body: "Body",
        staffResponse: null,
        createdAt: new Date("2026-01-01"),
      });
      setupMocks({
        select: vi.fn(() => makeChain([makeRow(5), makeRow(3)])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantReviews } = await import("./actions");
      const result = await getAssistantReviews();
      expect(result.stats.avgRating).toBe(4); // (5+3)/2 = 4
      expect(result.stats.totalReviews).toBe(2);
    });

    it("computes responseRate correctly", async () => {
      vi.resetModules();
      const rows = [
        {
          id: 1,
          firstName: "A",
          lastName: "B",
          rating: 5,
          serviceName: "S",
          source: null,
          body: "x",
          staffResponse: "Thanks!",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: 2,
          firstName: "C",
          lastName: "D",
          rating: 4,
          serviceName: "S",
          source: null,
          body: "y",
          staffResponse: null,
          createdAt: new Date("2026-01-02"),
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantReviews } = await import("./actions");
      const result = await getAssistantReviews();
      expect(result.stats.responseRate).toBe(50); // 1/2 = 50%
      expect(result.stats.repliedCount).toBe(1);
    });
  });

  /* ---- assistantSaveReply ---- */

  describe("assistantSaveReply", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { assistantSaveReply } = await import("./actions");
      await expect(assistantSaveReply(1, "Thanks!")).rejects.toThrow("Not authenticated");
    });

    it("throws when review not found (no bookingId)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { assistantSaveReply } = await import("./actions");
      await expect(assistantSaveReply(99, "Reply")).rejects.toThrow("Review not found");
    });

    it("throws when booking staffId does not match logged-in user", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ bookingId: 10 }]);
          return makeChain([{ staffId: "other-staff" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { assistantSaveReply } = await import("./actions");
      await expect(assistantSaveReply(1, "Hi")).rejects.toThrow(
        "Not authorized to reply to this review",
      );
    });

    it("saves reply when booking belongs to the logged-in assistant", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ bookingId: 10 }]);
          return makeChain([{ staffId: "user-1" }]); // matches logged-in user
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { assistantSaveReply } = await import("./actions");
      await assistantSaveReply(1, "Thank you for your kind words!");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          staffResponse: "Thank you for your kind words!",
          staffRespondedAt: expect.any(Date),
        }),
      );
    });

    it("sets staffResponse to null when reply is blank", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ bookingId: 10 }]);
          return makeChain([{ staffId: "user-1" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { assistantSaveReply } = await import("./actions");
      await assistantSaveReply(1, "   ");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ staffResponse: null, staffRespondedAt: null }),
      );
    });

    it("revalidates /dashboard/reviews", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ bookingId: 10 }]);
          return makeChain([{ staffId: "user-1" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { assistantSaveReply } = await import("./actions");
      await assistantSaveReply(1, "Nice!");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/reviews");
    });
  });
});
