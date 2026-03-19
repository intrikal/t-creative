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
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

const mockSelect = vi.fn();
const mockCaptureException = vi.fn();

function setupMocks(rows: unknown[] = []) {
  vi.doMock("@/db", () => ({
    db: {
      select: mockSelect.mockReturnValue(makeChain(rows)),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    reviews: {
      id: "id",
      rating: "rating",
      body: "body",
      serviceName: "service_name",
      staffResponse: "staff_response",
      createdAt: "created_at",
      clientId: "client_id",
      isFeatured: "is_featured",
      status: "status",
    },
    profiles: {
      id: "id",
      firstName: "first_name",
      lastName: "last_name",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
  }));
  vi.doMock("@sentry/nextjs", () => ({
    captureException: mockCaptureException,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("getFeaturedReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns featured reviews ordered by date", async () => {
    const rows = [
      {
        id: 1,
        rating: 5,
        body: "Amazing lash work!",
        serviceName: "Lash Extensions",
        staffResponse: "Thank you!",
        createdAt: new Date("2025-06-01"),
        firstName: "Jane",
        lastName: "Doe",
      },
      {
        id: 2,
        rating: 4,
        body: "Great jewelry",
        serviceName: "Permanent Jewelry",
        staffResponse: null,
        createdAt: new Date("2025-05-15"),
        firstName: "Alice",
        lastName: "Smith",
      },
    ];

    setupMocks(rows);
    const { getFeaturedReviews } = await import("./public-reviews");

    const result = await getFeaturedReviews();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      client: "Jane Doe",
      initials: "JD",
      rating: 5,
      body: "Amazing lash work!",
      serviceName: "Lash Extensions",
    });
    expect(result[1]).toMatchObject({
      id: 2,
      client: "Alice Smith",
      initials: "AS",
      rating: 4,
    });
  });

  it("returns empty array when no featured reviews exist", async () => {
    setupMocks([]);
    const { getFeaturedReviews } = await import("./public-reviews");

    const result = await getFeaturedReviews();

    expect(result).toEqual([]);
  });

  it("returns empty array and reports to Sentry on database error", async () => {
    vi.doMock("@/db", () => ({
      db: {
        select: () => {
          throw new Error("DB error");
        },
      },
    }));
    vi.doMock("@/db/schema", () => ({
      reviews: {},
      profiles: {},
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(),
      and: vi.fn(),
      desc: vi.fn(),
    }));
    vi.doMock("@sentry/nextjs", () => ({
      captureException: mockCaptureException,
    }));

    const { getFeaturedReviews } = await import("./public-reviews");

    const result = await getFeaturedReviews();

    expect(result).toEqual([]);
    expect(mockCaptureException).toHaveBeenCalledOnce();
  });

  it("handles missing profile names gracefully", async () => {
    setupMocks([
      {
        id: 3,
        rating: 5,
        body: "Great service",
        serviceName: null,
        staffResponse: null,
        createdAt: new Date("2025-07-01"),
        firstName: null,
        lastName: null,
      },
    ]);
    const { getFeaturedReviews } = await import("./public-reviews");

    const result = await getFeaturedReviews();

    expect(result[0].client).toBe("Anonymous");
    expect(result[0].initials).toBe("AN");
  });
});
